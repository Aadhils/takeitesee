'use client';

import { usePublicProviderTranslations } from '../i18n/PublicProviderTranslations';
import { Badge, Card } from '../ui/primitives';
import { MarketplaceReportForm } from './MarketplaceReportForm';

type PublicPortfolioMedia = {
  id: string;
  media_type: 'image' | 'video';
  caption: string;
};

export function PortfolioMediaSafetyPanel({ media }: { media: PublicPortfolioMedia[] }) {
  const { t } = usePublicProviderTranslations();
  if (!media.length) return null;

  return <section className="detail-section" aria-labelledby="portfolio-media-safety-heading">
    <div className="section-heading">
      <div>
        <span className="eyebrow">{t('publicProvider.portfolioSafety.eyebrow')}</span>
        <h2 id="portfolio-media-safety-heading">{t('publicProvider.portfolioSafety.title')}</h2>
      </div>
      <Badge tone="info">{t('publicProvider.portfolioSafety.signedInUsers')}</Badge>
    </div>
    <p className="detail-copy">{t('publicProvider.portfolioSafety.intro')}</p>
    <div style={{ display: 'grid', gap: '.75rem' }}>
      {media.map((item) => <Card key={item.id}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">{item.media_type === 'image' ? t('publicProvider.portfolioSafety.photo') : t('publicProvider.portfolioSafety.video')}</span>
            <h3>{item.caption || t('publicProvider.portfolioSafety.sampleFallback')}</h3>
          </div>
          <MarketplaceReportForm
            targetType="portfolio_media"
            targetId={item.id}
            label={item.media_type === 'image' ? t('publicProvider.portfolioSafety.reportPhoto') : t('publicProvider.portfolioSafety.reportVideo')}
          />
        </div>
      </Card>)}
    </div>
  </section>;
}
