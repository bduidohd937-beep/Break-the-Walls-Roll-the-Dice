param(
    [Parameter(Position=0)]
    [string]$Command,

    [Parameter(Position=1)]
    [string]$Type,

    [Parameter(Position=2)]
    [string]$Id,

    [Parameter(Position=3)]
    [string]$Name,

    [Parameter(Position=4)]
    [string]$Action,

    [switch]$DryRun
)

$Root = "C:\Users\bduid\Pictures\성벽을부수고 주사위를 굴려라"
$Working = Join-Path $Root "90_WORKING"
$Final = Join-Path $Root "10_게임용_최종에셋"
$Archive = Join-Path $Root "99_ARCHIVE"
$Manager = Join-Path $Root "00_MASTER\asset_manager"
$Inventory = Join-Path $Manager "asset_inventory.csv"

function Update-Inventory {

    $files = @(
        Get-ChildItem $Root -File -Recurse -ErrorAction SilentlyContinue |
        Where-Object {
            $_.FullName -notmatch "\\00_MASTER\\asset_manager\\" -and
            $_.FullName -notmatch "\\99_ARCHIVE\\"
        }
    )

    $rows = foreach ($file in $files) {

        $relative = $file.FullName.Substring($Root.Length).TrimStart("\")
        $parts = $relative -split "\\"

        [PSCustomObject]@{
            FileName     = $file.Name
            Extension    = $file.Extension.ToLower()
            SizeKB       = [math]::Round($file.Length / 1KB, 1)
            RootFolder   = if ($parts.Count -gt 0) { $parts[0] } else { "" }
            RelativePath = $relative
            LastModified = $file.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
        }
    }

    $rows | Export-Csv -Path $Inventory -NoTypeInformation -Encoding UTF8

    Write-Host "Inventory updated: $($rows.Count) files"
}

function SafeMove {

    param(
        [string]$Source,
        [string]$Destination
    )

    if (!(Test-Path -LiteralPath $Source)) {
        Write-Host "SOURCE NOT FOUND:"
        Write-Host $Source
        return $false
    }

    $parent = Split-Path -Parent $Destination

    New-Item `
        -ItemType Directory `
        -Force `
        -Path $parent |
        Out-Null

    if (Test-Path -LiteralPath $Destination) {

        $base = [IO.Path]::GetFileName($Destination)

        $conflict = Join-Path `
            $parent `
            ($base + "_CONFLICT_" + (Get-Date -Format "yyyyMMdd_HHmmss"))

        $Destination = $conflict
    }

    if ($DryRun) {

        Write-Host "[DRY-RUN]"
        Write-Host "FROM: $Source"
        Write-Host "TO  : $Destination"

        return $true
    }

    Move-Item `
        -LiteralPath $Source `
        -Destination $Destination

    Write-Host "MOVED:"
    Write-Host $Destination

    return $true
}

function Get-NextVersion {

    param(
        [string]$Type,
        [string]$Id,
        [string]$Name
    )

    $searchRoots = @(
        $Working,
        $Final
    )

    $versions = @()

    foreach ($root in $searchRoots) {

        if (!(Test-Path -LiteralPath $root)) {
            continue
        }

        Get-ChildItem `
            -LiteralPath $root `
            -File `
            -Recurse `
            -ErrorAction SilentlyContinue |
        ForEach-Object {

            $baseName = $_.BaseName

            $escapedType = [regex]::Escape($Type.ToUpper())
            $escapedId = [regex]::Escape($Id.ToUpper())
            $escapedName = [regex]::Escape($Name.ToUpper())

            $pattern = "^${escapedType}_${escapedId}_${escapedName}_.+_V([0-9]+)$"

            if ($baseName.ToUpper() -match $pattern) {
                $versions += [int]$Matches[1]
            }
        }
    }

    if ($versions.Count -eq 0) {
        return 1
    }

    return (($versions | Measure-Object -Maximum).Maximum + 1)
}

function Get-StandardFileName {

    param(
        [string]$AssetType,
        [string]$AssetId,
        [string]$AssetName,
        [string]$AssetAction,
        [int]$Version = 1,
        [string]$Extension = ".png"
    )

    $cleanType = $AssetType.ToUpper()
    $cleanId = $AssetId.ToUpper()
    $cleanName = $AssetName.ToUpper() -replace '[^A-Z0-9가-힣_-]', '_'
    $cleanAction = $AssetAction.ToUpper() -replace '[^A-Z0-9가-힣_-]', '_'

    return "${cleanType}_${cleanId}_${cleanName}_${cleanAction}_V$("{0:D2}" -f $Version)$Extension"
}

function Check-AssetNames {

    $files = @(
        Get-ChildItem `
            $Root `
            -File `
            -Recurse `
            -ErrorAction SilentlyContinue |
        Where-Object {
            $_.FullName -notmatch "\\00_MASTER\\asset_manager\\" -and
            $_.FullName -notmatch "\\99_ARCHIVE\\"
        }
    )

    $imageFiles = @(
        $files |
        Where-Object {
            $_.Extension.ToLower() -in @(
                ".png",
                ".jpg",
                ".jpeg",
                ".gif",
                ".webp"
            )
        }
    )

    $bad = @()

    foreach ($file in $imageFiles) {

        $name = $file.BaseName

        $valid =
            $name -match '^HERO_[A-Z0-9]+_.+_.+_V[0-9]+$' -or
            $name -match '^ENEMY_[A-Z0-9]+_.+_.+_V[0-9]+$' -or
            $name -match '^BOSS_[A-Z0-9]+_.+_.+_V[0-9]+$' -or
            $name -match '^NPC_[A-Z0-9]+_.+_.+_V[0-9]+$' -or
            $name -match '^VFX_[A-Z0-9]+_.+_.+_V[0-9]+$' -or
            $name -match '^UI_[A-Z0-9]+_.+_.+_V[0-9]+$' -or
            $name -match '^STAGE_[A-Z0-9]+_.+_.+_V[0-9]+$'

        if (!$valid) {
            $bad += $file
        }
    }

    Write-Host ""
    Write-Host "===== ASSET NAME CHECK ====="

    if ($bad.Count -eq 0) {

        Write-Host "규격 외 이미지 파일 없음"

    } else {

        Write-Host "규격 외 이미지: $($bad.Count)개"
        Write-Host ""

        foreach ($file in $bad) {
            Write-Host $file.FullName
        }
    }

    Write-Host ""
}

switch ($Command.ToLower()) {

    "new" {

        if (!$Type -or !$Id -or !$Name) {

            Write-Host ""
            Write-Host "사용법:"
            Write-Host ".\asset.ps1 new HERO 025 BASTET"
            Write-Host ""

            exit
        }

        $base = Join-Path `
            $Working `
            "${Id}_${Name}"

        switch ($Type.ToUpper()) {

            "HERO" {

                $folders = @(
                    "00_REFERENCE",
                    "01_CHARACTER",
                    "02_SPRITE",
                    "03_ANIMATION",
                    "04_VFX",
                    "05_UI"
                )
            }

            "ENEMY" {

                $folders = @(
                    "00_REFERENCE",
                    "01_CHARACTER",
                    "02_SPRITE",
                    "03_ANIMATION",
                    "04_VFX"
                )
            }

            "BOSS" {

                $folders = @(
                    "00_REFERENCE",
                    "01_CHARACTER",
                    "02_SPRITE",
                    "03_ANIMATION",
                    "04_VFX",
                    "05_UI"
                )
            }

            "NPC" {

                $folders = @(
                    "00_REFERENCE",
                    "01_CHARACTER",
                    "02_SPRITE",
                    "03_ANIMATION",
                    "05_UI"
                )
            }

            "VFX" {

                $folders = @(
                    "00_REFERENCE",
                    "01_SOURCE",
                    "02_FINAL"
                )
            }

            "UI" {

                $folders = @(
                    "00_REFERENCE",
                    "01_SOURCE",
                    "02_FINAL"
                )
            }

            "STAGE" {

                $folders = @(
                    "00_REFERENCE",
                    "01_BACKGROUND",
                    "02_OBJECT",
                    "03_EFFECT",
                    "04_UI"
                )
            }

            default {

                Write-Host ""
                Write-Host "지원 Type:"
                Write-Host "HERO / ENEMY / BOSS / NPC / VFX / UI / STAGE"
                Write-Host ""

                exit
            }
        }

        foreach ($folder in $folders) {

            New-Item `
                -ItemType Directory `
                -Force `
                -Path (Join-Path $base $folder) |
                Out-Null
        }

        Write-Host ""
        Write-Host "===== NEW ASSET CREATED ====="
        Write-Host $base
        Write-Host ""
    }

    "find" {

        if (!$Type) {

            Write-Host ".\asset.ps1 find BASTET"
            exit
        }

        Write-Host ""
        Write-Host "===== SEARCH: $Type ====="
        Write-Host ""

        Get-ChildItem `
            $Root `
            -File `
            -Recurse `
            -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Name -like "*$Type*" -or
            $_.FullName -like "*$Type*"
        } |
        Select-Object -ExpandProperty FullName

        Write-Host ""
    }

    "filename" {

        if (!$Type -or !$Id -or !$Name -or !$Action) {

            Write-Host ""
            Write-Host "사용법:"
            Write-Host ".\asset.ps1 filename HERO 025 BASTET ATTACK"
            Write-Host ""

            exit
        }

        $filename = Get-StandardFileName `
            -AssetType $Type `
            -AssetId $Id `
            -AssetName $Name `
            -AssetAction $Action `
            -Version 1 `
            -Extension ".png"

        Write-Host ""
        Write-Host "===== STANDARD FILE NAME ====="
        Write-Host $filename
        Write-Host ""
    }

    "next" {

        if (!$Type -or !$Id -or !$Name) {

            Write-Host ""
            Write-Host "사용법:"
            Write-Host ".\asset.ps1 next HERO 025 BASTET"
            Write-Host ""

            exit
        }

        $version = Get-NextVersion `
            -Type $Type `
            -Id $Id `
            -Name $Name

        Write-Host ""
        Write-Host "===== NEXT VERSION ====="
        Write-Host ("다음 버전: V" + [string]$version)
        Write-Host ""
    }

    "check" {

        Check-AssetNames
    }

    "approve" {

        if (!$Type -or !$Id -or !$Name) {

            Write-Host ""
            Write-Host "사용법:"
            Write-Host ".\asset.ps1 approve HERO 025 BASTET"
            Write-Host ""

            exit
        }

        $source = Join-Path `
            $Working `
            "${Id}_${Name}"

        $destination = Join-Path `
            $Final `
            "$($Type.ToUpper())\${Id}_${Name}"

        if (!(Test-Path -LiteralPath $source)) {

            Write-Host ""
            Write-Host "WORKING ASSET NOT FOUND:"
            Write-Host $source
            Write-Host ""

            exit
        }

        if (Test-Path -LiteralPath $destination) {

            $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

            $archiveDestination = Join-Path `
                $Archive `
                "SUPERSEDED\${Id}_${Name}_$timestamp"

            Write-Host ""
            Write-Host "기존 FINAL이 존재합니다."

            if ($DryRun) {

                Write-Host "[DRY-RUN]"
                Write-Host "기존 FINAL:"
                Write-Host $destination
                Write-Host "SUPERSEDED:"
                Write-Host $archiveDestination

            } else {

                New-Item `
                    -ItemType Directory `
                    -Force `
                    -Path $archiveDestination |
                    Out-Null

                Get-ChildItem `
                    -LiteralPath $destination `
                    -Force |
                Move-Item `
                    -Destination $archiveDestination

                Remove-Item `
                    -LiteralPath $destination `
                    -Force
            }
        }

        $result = SafeMove `
            -Source $source `
            -Destination $destination

        if ($result -and !$DryRun) {
            Update-Inventory
        }

        Write-Host ""
        Write-Host "===== APPROVAL COMPLETE ====="
        Write-Host ""
    }

    "archive" {

        if (!$Type -or !$Id -or !$Name) {

            Write-Host ""
            Write-Host "사용법:"
            Write-Host ".\asset.ps1 archive HERO 025 BASTET"
            Write-Host ""

            exit
        }

        $source = Join-Path `
            $Working `
            "${Id}_${Name}"

        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

        $destination = Join-Path `
            $Archive `
            "REJECTED\${Id}_${Name}_$timestamp"

        $result = SafeMove `
            -Source $source `
            -Destination $destination

        if ($result -and !$DryRun) {
            Update-Inventory
        }

        Write-Host ""
        Write-Host "===== ARCHIVE COMPLETE ====="
        Write-Host ""
    }

    "inventory" {

        Update-Inventory
    }

    "status" {

        $sourceCount = @(
            Get-ChildItem `
                $Root `
                -File `
                -Recurse `
                -ErrorAction SilentlyContinue |
            Where-Object {
                $_.FullName -notmatch "\\90_WORKING\\" -and
                $_.FullName -notmatch "\\10_게임용_최종에셋\\" -and
                $_.FullName -notmatch "\\99_ARCHIVE\\" -and
                $_.FullName -notmatch "\\00_MASTER\\asset_manager\\"
            }
        ).Count

        $workingCount = @(
            Get-ChildItem `
                $Working `
                -File `
                -Recurse `
                -ErrorAction SilentlyContinue
        ).Count

        $finalCount = @(
            Get-ChildItem `
                $Final `
                -File `
                -Recurse `
                -ErrorAction SilentlyContinue
        ).Count

        $archiveCount = @(
            Get-ChildItem `
                $Archive `
                -File `
                -Recurse `
                -ErrorAction SilentlyContinue
        ).Count

        $total = `
            $sourceCount +
            $workingCount +
            $finalCount +
            $archiveCount

        Write-Host ""
        Write-Host "================================"
        Write-Host " BTWRD ASSET STATUS 1.2"
        Write-Host "================================"
        Write-Host "SOURCE  : $sourceCount files"
        Write-Host "WORKING : $workingCount files"
        Write-Host "FINAL   : $finalCount files"
        Write-Host "ARCHIVE : $archiveCount files"
        Write-Host "----------------"
        Write-Host "TOTAL   : $total files"
        Write-Host ""
    }

    default {

        Write-Host ""
        Write-Host "========================================"
        Write-Host " BREAK THE WALLS - ASSET MANAGER 1.2"
        Write-Host "========================================"
        Write-Host ""
        Write-Host "새 에셋:"
        Write-Host ".\asset.ps1 new HERO 025 BASTET"
        Write-Host ""
        Write-Host "검색:"
        Write-Host ".\asset.ps1 find BASTET"
        Write-Host ""
        Write-Host "파일명 생성:"
        Write-Host ".\asset.ps1 filename HERO 025 BASTET ATTACK"
        Write-Host ""
        Write-Host "다음 버전:"
        Write-Host ".\asset.ps1 next HERO 025 BASTET"
        Write-Host ""
        Write-Host "파일명 검사:"
        Write-Host ".\asset.ps1 check"
        Write-Host ""
        Write-Host "최종 승인:"
        Write-Host ".\asset.ps1 approve HERO 025 BASTET"
        Write-Host ""
        Write-Host "보관:"
        Write-Host ".\asset.ps1 archive HERO 025 BASTET"
        Write-Host ""
        Write-Host "현황:"
        Write-Host ".\asset.ps1 status"
        Write-Host ""
        Write-Host "인벤토리:"
        Write-Host ".\asset.ps1 inventory"
        Write-Host ""
        Write-Host "미리보기:"
        Write-Host ".\asset.ps1 approve HERO 025 BASTET -DryRun"
        Write-Host ""
    }
}




