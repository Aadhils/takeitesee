'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../i18n/LanguageProvider';
import styles from './ProductSmartFilters.module.css';

type Props = {
  stock: string;
  shop: string;
  sort: string;
  resultCount: number;
  loading: boolean;
  onStockChange: (value: string) => void;
  onShopChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onClearAll: () => void;
};

function FilterIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4" /></svg>;
}

function CloseIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 7 10 10M17 7 7 17" /></svg>;
}

function ChevronDownIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg>;
}

export default function ProductSmartFilters({
  stock,
  shop,
  sort,
  resultCount,
  loading,
  onStockChange,
  onShopChange,
  onSortChange,
  onClearAll,
}: Props) {
  const { locale } = useLanguage();
  const tamil = locale === 'ta-IN';
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const copy = tamil
    ? {
      filters: 'வடிகட்டிகள்',
      filterProducts: 'Products-ஐ வடிகட்டுங்கள்',
      filterHelp: 'Stock மற்றும் Shop நிலையை தேர்வு செய்யுங்கள். முடிவுகள் உடனே புதுப்பிக்கப்படும்.',
      stock: 'Stock நிலை',
      shop: 'Shop நிலை',
      anyStock: 'எந்த stock நிலையும்',
      orderable: 'Order செய்யக்கூடியவை',
      inStock: 'Stock உள்ளவை',
      madeToOrder: 'Order அடிப்படையில்',
      anyShop: 'Open/Closed அனைத்தும்',
      openOnly: 'Shop Open மட்டும்',
      sortResults: 'Products வரிசை',
      relevance: 'Useful முதலில்',
      lowPrice: 'குறைந்த விலை',
      highPrice: 'அதிக விலை',
      name: 'பெயர்',
      clear: 'Filters clear செய்',
      showResults: (count: number) => count === 1 ? '1 product காட்டுங்கள்' : `${count} products காட்டுங்கள்`,
      updating: 'Products புதுப்பிக்கப்படுகின்றன…',
      activeFilters: 'செயலில் உள்ள வடிகட்டிகள்',
      closeFilters: 'வடிகட்டி மெனுவை மூடுங்கள்',
      closeSort: 'வரிசைப்படுத்தும் மெனுவை மூடுங்கள்',
    }
    : {
      filters: 'Filters',
      filterProducts: 'Filter products',
      filterHelp: 'Choose stock and Shop status. Results update as you filter.',
      stock: 'Stock',
      shop: 'Shop status',
      anyStock: 'Any stock status',
      orderable: 'Orderable only',
      inStock: 'In stock',
      madeToOrder: 'Made to order',
      anyShop: 'Open or Closed',
      openOnly: 'Shop Open only',
      sortResults: 'Sort products',
      relevance: 'Useful first',
      lowPrice: 'Lowest price',
      highPrice: 'Highest price',
      name: 'Name',
      clear: 'Clear filters',
      showResults: (count: number) => count === 1 ? 'Show 1 product' : `Show ${count} products`,
      updating: 'Updating products…',
      activeFilters: 'Active filters',
      closeFilters: 'Close filter menu',
      closeSort: 'Close sort menu',
    };

  useEffect(() => {
    if (!drawerOpen && !sortOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        setSortOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen, sortOpen]);

  const stockOptions = useMemo(() => [
    { value: 'any', label: copy.anyStock },
    { value: 'orderable', label: copy.orderable },
    { value: 'in_stock', label: copy.inStock },
    { value: 'made_to_order', label: copy.madeToOrder },
  ], [copy.anyStock, copy.inStock, copy.madeToOrder, copy.orderable]);

  const shopOptions = useMemo(() => [
    { value: 'any', label: copy.anyShop },
    { value: 'open', label: copy.openOnly },
  ], [copy.anyShop, copy.openOnly]);

  const sortChoices = useMemo(() => [
    { value: 'relevance', label: copy.relevance },
    { value: 'price', label: copy.lowPrice },
    { value: 'price-desc', label: copy.highPrice },
    { value: 'name', label: copy.name },
  ], [copy.highPrice, copy.lowPrice, copy.name, copy.relevance]);

  const stockLabel = stockOptions.find((option) => option.value === stock)?.label || copy.anyStock;
  const shopLabel = shopOptions.find((option) => option.value === shop)?.label || copy.anyShop;
  const currentSortLabel = sortChoices.find((option) => option.value === sort)?.label || copy.relevance;
  const activeFilterCount = Number(stock !== 'any') + Number(shop !== 'any');

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (stock !== 'any') chips.push({ key: 'stock', label: stockLabel, clear: () => onStockChange('any') });
    if (shop !== 'any') chips.push({ key: 'shop', label: shopLabel, clear: () => onShopChange('any') });
    return chips;
  }, [onShopChange, onStockChange, shop, shopLabel, stock, stockLabel]);

  const openFilters = () => {
    setSortOpen(false);
    setDrawerOpen(true);
  };

  const openSort = () => {
    setDrawerOpen(false);
    setSortOpen(true);
  };

  const chooseSort = (value: string) => {
    onSortChange(value);
    setSortOpen(false);
  };

  return <div className={`${styles.root} product-smart-filters`}>
    <div className={styles.desktopToolbar} aria-label={copy.filterProducts}>
      <label className={styles.compactControl}>
        <span className={styles.srOnly}>{copy.stock}</span>
        <select value={stock} onChange={(event) => onStockChange(event.target.value)}>
          {stockOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className={styles.compactControl}>
        <span className={styles.srOnly}>{copy.shop}</span>
        <select value={shop} onChange={(event) => onShopChange(event.target.value)}>
          {shopOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <button type="button" className={`${styles.sortButton} ${sortOpen ? styles.active : ''}`} onClick={openSort} aria-expanded={sortOpen} aria-controls="product-sort-menu">
        <span>{currentSortLabel}</span><ChevronDownIcon />
      </button>
      {activeFilterCount || sort !== 'relevance' ? <button type="button" className={styles.clearButton} onClick={onClearAll}>{copy.clear}</button> : null}
    </div>

    <div className={styles.mobileToolbar}>
      <button type="button" className={`${styles.filterButton} ${activeFilterCount ? styles.active : ''}`} onClick={openFilters} aria-expanded={drawerOpen} aria-controls="product-filter-sheet">
        <FilterIcon /><span>{copy.filters}</span>{activeFilterCount ? <b>{activeFilterCount}</b> : null}
      </button>
      <button type="button" className={`${styles.sortButton} ${sortOpen ? styles.active : ''}`} onClick={openSort} aria-expanded={sortOpen} aria-controls="product-sort-menu">
        <span>{currentSortLabel}</span><ChevronDownIcon />
      </button>
    </div>

    {activeChips.length ? <div className={styles.activeChips} aria-label={copy.activeFilters}>
      {activeChips.map((chip) => <button type="button" key={chip.key} onClick={chip.clear}><span>{chip.label}</span><CloseIcon /></button>)}
    </div> : null}

    {drawerOpen ? <div className={styles.drawerBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setDrawerOpen(false); }}>
      <section id="product-filter-sheet" className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="product-filter-title">
        <div className={styles.drawerHeading}>
          <div><span className="eyebrow">{copy.filters}</span><h2 id="product-filter-title">{copy.filterProducts}</h2><p>{copy.filterHelp}</p></div>
          <button type="button" className={styles.closeButton} onClick={() => setDrawerOpen(false)} aria-label={copy.closeFilters}><CloseIcon /></button>
        </div>
        <div className={styles.drawerFields}>
          <label><span>{copy.stock}</span><select value={stock} onChange={(event) => onStockChange(event.target.value)}>{stockOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label><span>{copy.shop}</span><select value={shop} onChange={(event) => onShopChange(event.target.value)}>{shopOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        </div>
        <div className={styles.drawerFooter}>
          <button type="button" className={styles.drawerClear} onClick={onClearAll}>{copy.clear}</button>
          <button type="button" className={styles.drawerApply} onClick={() => setDrawerOpen(false)}>{loading ? copy.updating : copy.showResults(resultCount)}</button>
        </div>
      </section>
    </div> : null}

    {sortOpen ? <div className={styles.sortBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setSortOpen(false); }}>
      <section id="product-sort-menu" className={styles.sortPanel} role="dialog" aria-modal="true" aria-labelledby="product-sort-title">
        <div className={styles.sortHeading}><strong id="product-sort-title">{copy.sortResults}</strong><button type="button" className={styles.closeButton} onClick={() => setSortOpen(false)} aria-label={copy.closeSort}><CloseIcon /></button></div>
        <div className={styles.sortOptions}>
          {sortChoices.map((choice) => <button type="button" key={choice.value} className={sort === choice.value ? styles.selectedSort : ''} onClick={() => chooseSort(choice.value)} aria-pressed={sort === choice.value}><span>{choice.label}</span><span className={styles.sortRadio} aria-hidden="true">{sort === choice.value ? <i /> : null}</span></button>)}
        </div>
      </section>
    </div> : null}
  </div>;
}
