export function ShopPanel() {
  return <section className="kingdom-placeholder-panel"><h2>상점</h2><p>상품과 가격이 확정되면 이곳에 표시됩니다.</p><div className="shop-shelves">{["일반 상품", "일일 상품", "이벤트 상품"].map(name=><div key={name}><h3>{name}</h3><span>준비 중</span></div>)}</div></section>;
}
