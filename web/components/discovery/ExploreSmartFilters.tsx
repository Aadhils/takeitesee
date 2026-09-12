'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../i18n/LanguageProvider';
import styles from './ExploreSmartFilters.module.css';

type CategoryOption = { value: string; label: string };

type Props = {
  categories: CategoryOption[];
  category: string;
  location: string;
  price: string;
  rating: string;
  provider: string;
  availability: string;
  sort: string;
  preciseNearbyActive: boolean;
  geoActive: boolean;
  geoLocating: boolean;
  nearMeIntent: boolean;
  resultCount: number;
  loading: boolean;
  onCategoryChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onPriceChange: (value: string) => void;
  onRatingChange: (value: string) => void;
  onProviderChange: (value: string) => void;
  onAvailabilityChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onClearAll: () => void;
  onUseCurrentLocation: () => void;
  onClearCurrentLocation: () => void;
};

function PinIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11Z" /><circle cx="12" cy="10" r="2.2" /></svg>;
}

function FilterIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4" /></svg>;
}

function CloseIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 7 10 10M17 7 7 17" /></svg>;
}

function ChevronDownIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg>;
}

export default function ExploreSmartFilters({
  categories,
  category,
  location,
  price,
  rating,
  provider,
  availability,
  sort,
  preciseNearbyActive,
  geoActive,
  geoLocating,
  nearMeIntent,
  resultCount,
  loading,
  onCategoryChange,
  onLocationChange,
  onPriceChange,
  onRatingChange,
  onProviderChange,
  onAvailabilityChange,
  onSortChange,
  onClearAll,
  onUseCurrentLocation,
  onClearCurrentLocation,
}: Props) {
  const { locale, t } = useLanguage();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const tamil = locale === 'ta-IN';
  const copy = tamil
    ? {
      filters: 'வடிகட்டிகள்',
      filterServices: 'சேவைகளை வடிகட்டுங்கள்',
      filterHelp: 'தேவையானவற்றை மட்டும் தேர்வு செய்யுங்கள். முடிவுகள் உடனே புதுப்பிக்கப்படும்.',
      showResults: (count: number) => count === 1 ? '1 சேவையை காட்டுங்கள்' : `${count} சேவைகளை காட்டுங்கள்`,
      updating: 'முடிவுகள் புதுப்பிக்கப்படுகின்றன…',
      nearMe: 'என் அருகில்',
      activeFilters: 'செயலில் உள்ள வடிகட்டிகள்',
      close: 'வடிகட்டி மெனுவை மூடுங்கள்',
      closeSort: 'வரிசைப்படுத்தும் மெனுவை மூடுங்கள்',
    }
    : {
      filters: 'Filters',
      filterServices: 'Filter services',
      filterHelp: 'Choose only what matters. Results update as you filter.',
      showResults: (count: number) => count === 1 ? 'Show 1 service' : `Show ${count} services`,
      updating: 'Updating results…',
      nearMe: 'Near me',
      activeFilters: 'Active filters',
      close: 'Close filter menu',
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

  const categoryLabel = category === 'all'
    ? t('explore.allCategories')
    : categories.find((option) => option.value === category)?.label || category;
  const priceLabel = price === 'under-1000' ? t('explore.under1000')
    : price === '1000-5000' ? t('explore.range1000to5000')
      : price === 'over-5000' ? t('explore.over5000')
        : t('explore.anyPrice');
  const ratingLabel = rating === '4-plus' ? t('explore.rating4')
    : rating === '4.5-plus' ? t('explore.rating45')
      : t('explore.anyRating');
  const providerLabel = provider === 'professional' ? t('explore.professional')
    : provider === 'business' ? t('explore.business')
      : t('explore.anyProvider');
  const availabilityLabel = availability === 'available-now' ? t('explore.availabilityNowOnly') : t('explore.availabilityAny');
  const locationValue = location === 'Anywhere' ? '' : location;

  const sortChoices = useMemo(() => [
    { value: 'relevance', label: t('explore.relevance') },
    ...(preciseNearbyActive ? [{ value: 'nearest', label: t('explore.nearestFirst') }] : []),
    { value: 'rating', label: t('explore.highestRated') },
    { value: 'price', label: t('explore.lowestPrice') },
    { value: 'price-desc', label: t('explore.highestPrice') },
  ], [preciseNearbyActive, t]);
  const currentSortLabel = sortChoices.find((option) => option.value === sort)?.label || t('explore.relevance');

  const activeFilterCount = useMemo(() => [
    category !== 'all',
    Boolean(locationValue) || geoActive,
    price !== 'any',
    rating !== 'any',
    provider !== 'any',
    availability !== 'any',
  ].filter(Boolean).length, [availability, category, geoActive, locationValue, price, provider, rating]);

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (category !== 'all') chips.push({ key: 'category', label: categoryLabel, clear: () => onCategoryChange('all') });
    if (locationValue) chips.push({ key: 'location', label: locationValue, clear: () => onLocationChange('Anywhere') });
    else if (geoActive) chips.push({ key: 'geo', label: copy.nearMe, clear: onClearCurrentLocation });
    if (price !== 'any') chips.push({ key: 'price', label: priceLabel, clear: () => onPriceChange('any') });
    if (rating !== 'any') chips.push({ key: 'rating', label: ratingLabel, clear: () => onRatingChange('any') });
    if (provider !== 'any') chips.push({ key: 'provider', label: providerLabel, clear: () => onProviderChange('any') });
    if (availability !== 'any') chips.push({ key: 'availability', label: availabilityLabel, clear: () => onAvailabilityChange('any') });
    return chips;
  }, [availability, availabilityLabel, category, categoryLabel, copy.nearMe, geoActive, locationValue, onAvailabilityChange, onCategoryChange, onClearCurrentLocation, onLocationChange, onPriceChange, onProviderChange, onRatingChange, price, priceLabel, provider, providerLabel, rating, ratingLabel]);

  const renderLocationAction = () => geoActive
    ? <button type="button" className={`${styles.locationButton} ${styles.active}`} onClick={onClearCurrentLocation}><PinIcon /><span>{preciseNearbyActive ? t('explore.nearbyRankingClear') : t('explore.clearCurrentLocation')}</span></button>
    : <button type="button" className={styles.locationButton} onClick={onUseCurrentLocation} disabled={geoLocating}><PinIcon /><span>{geoLocating ? '…' : nearMeIntent ? t('explore.useMyLocationNearby') : t('explore.useMyLocation')}</span></button>;

  const categoryOptions = <><option value="all">{t('explore.allCategories')}</option>{categories.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</>;

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

  return <div className={`${styles.root} explore-smart-filters`}>
    <div className={styles.desktopToolbar} aria-label={copy.filterServices}>
      <label className={styles.compactControl}><span className={styles.srOnly}>{t('explore.category')}</span><select value={category} onChange={(event) => onCategoryChange(event.target.value)}>{categoryOptions}</select></label>
      <label className={`${styles.compactControl} ${styles.locationControl}`}><span className={styles.srOnly}>{t('explore.location')}</span><input value={locationValue} onChange={(event) => onLocationChange(event.target.value.trim() ? event.target.value : 'Anywhere')} placeholder={t('explore.locationPlaceholder')} /></label>
      <label className={styles.compactControl}><span className={styles.srOnly}>{t('explore.price')}</span><select value={price} onChange={(event) => onPriceChange(event.target.value)}><option value="any">{t('explore.anyPrice')}</option><option value="under-1000">{t('explore.under1000')}</option><option value="1000-5000">{t('explore.range1000to5000')}</option><option value="over-5000">{t('explore.over5000')}</option></select></label>
      <label className={styles.compactControl}><span className={styles.srOnly}>{t('explore.rating')}</span><select value={rating} onChange={(event) => onRatingChange(event.target.value)}><option value="any">{t('explore.anyRating')}</option><option value="4-plus">{t('explore.rating4')}</option><option value="4.5-plus">{t('explore.rating45')}</option></select></label>
      <label className={styles.compactControl}><span className={styles.srOnly}>{t('explore.providerType')}</span><select value={provider} onChange={(event) => onProviderChange(event.target.value)}><option value="any">{t('explore.anyProvider')}</option><option value="professional">{t('explore.professional')}</option><option value="business">{t('explore.business')}</option></select></label>
      <label className={styles.compactControl}><span className={styles.srOnly}>{t('explore.availabilityLabel')}</span><select value={availability} onChange={(event) => onAvailabilityChange(event.target.value)}><option value="any">{t('explore.availabilityAny')}</option><option value="available-now">{t('explore.availabilityNowOnly')}</option></select></label>
      <button type="button" className={`${styles.sortButton} ${sortOpen ? styles.active : ''}`} onClick={openSort} aria-expanded={sortOpen} aria-controls="explore-sort-menu"><span>{currentSortLabel}</span><ChevronDownIcon /></button>
      {renderLocationAction()}
      {activeFilterCount ? <button type="button" className={styles.clearButton} onClick={onClearAll}>{t('explore.clearFilters')}</button> : null}
    </div>

    <div className={styles.mobileToolbar}>
      <button type="button" className={`${styles.filterButton} ${activeFilterCount ? styles.active : ''}`} onClick={openFilters} aria-expanded={drawerOpen} aria-controls="explore-filter-sheet"><FilterIcon /><span>{copy.filters}</span>{activeFilterCount ? <b>{activeFilterCount}</b> : null}</button>
      {renderLocationAction()}
      <button type="button" className={`${styles.sortButton} ${styles.mobileSortButton} ${sortOpen ? styles.active : ''}`} onClick={openSort} aria-expanded={sortOpen} aria-controls="explore-sort-menu"><span>{currentSortLabel}</span><ChevronDownIcon /></button>
    </div>

    {activeChips.length ? <div className={styles.activeChips} aria-label={copy.activeFilters}>{activeChips.map((chip) => <button type="button" key={chip.key} onClick={chip.clear}><span>{chip.label}</span><CloseIcon /></button>)}</div> : null}

    {drawerOpen ? <div className={styles.drawerBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setDrawerOpen(false); }}>
      <section id="explore-filter-sheet" className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="explore-filter-title">
        <div className={styles.drawerHeading}><div><span className="eyebrow">{copy.filters}</span><h2 id="explore-filter-title">{copy.filterServices}</h2><p>{copy.filterHelp}</p></div><button type="button" className={styles.closeButton} onClick={() => setDrawerOpen(false)} aria-label={copy.close}><CloseIcon /></button></div>
        <div className={styles.drawerFields}>
          <label><span>{t('explore.category')}</span><select value={category} onChange={(event) => onCategoryChange(event.target.value)}>{categoryOptions}</select></label>
          <label><span>{t('explore.location')}</span><input value={locationValue} onChange={(event) => onLocationChange(event.target.value.trim() ? event.target.value : 'Anywhere')} placeholder={t('explore.locationPlaceholder')} /></label>
          <div className={styles.drawerLocationAction}>{renderLocationAction()}</div>
          <label><span>{t('explore.price')}</span><select value={price} onChange={(event) => onPriceChange(event.target.value)}><option value="any">{t('explore.anyPrice')}</option><option value="under-1000">{t('explore.under1000')}</option><option value="1000-5000">{t('explore.range1000to5000')}</option><option value="over-5000">{t('explore.over5000')}</option></select></label>
          <label><span>{t('explore.rating')}</span><select value={rating} onChange={(event) => onRatingChange(event.target.value)}><option value="any">{t('explore.anyRating')}</option><option value="4-plus">{t('explore.rating4')}</option><option value="4.5-plus">{t('explore.rating45')}</option></select></label>
          <label><span>{t('explore.providerType')}</span><select value={provider} onChange={(event) => onProviderChange(event.target.value)}><option value="any">{t('explore.anyProvider')}</option><option value="professional">{t('explore.professional')}</option><option value="business">{t('explore.business')}</option></select></label>
          <label><span>{t('explore.availabilityLabel')}</span><select value={availability} onChange={(event) => onAvailabilityChange(event.target.value)}><option value="any">{t('explore.availabilityAny')}</option><option value="available-now">{t('explore.availabilityNowOnly')}</option></select></label>
        </div>
        <div className={styles.drawerFooter}><button type="button" className={styles.drawerClear} onClick={onClearAll}>{t('explore.clearFilters')}</button><button type="button" className={styles.drawerApply} onClick={() => setDrawerOpen(false)}>{loading ? copy.updating : copy.showResults(resultCount)}</button></div>
      </section>
    </div> : null}

    {sortOpen ? <>
      <button type="button" className={styles.sortBackdrop} aria-label={copy.closeSort} onClick={() => setSortOpen(false)} />
      <section id="explore-sort-menu" className={styles.sortPanel} role="dialog" aria-modal="true" aria-labelledby="explore-sort-title">
        <div className={styles.sortHeading}><strong id="explore-sort-title">{t('explore.sort')}</strong><button type="button" className={styles.sortClose} onClick={() => setSortOpen(false)} aria-label={copy.closeSort}><CloseIcon /></button></div>
        <div className={styles.sortOptions} role="listbox" aria-label={t('explore.sort')}>
          {sortChoices.map((option) => <button type="button" key={option.value} role="option" aria-selected={sort === option.value} className={sort === option.value ? styles.selectedSort : ''} onClick={() => chooseSort(option.value)}><span>{option.label}</span><span className={styles.sortRadio} aria-hidden="true"><i /></span></button>)}
        </div>
      </section>
    </> : null}
  </div>;
}
