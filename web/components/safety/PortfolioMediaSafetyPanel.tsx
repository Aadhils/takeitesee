'use client';

import { useLanguage } from '../i18n/LanguageProvider';
import { Badge, Card } from '../ui/primitives';
import { MarketplaceReportForm } from './MarketplaceReportForm';

type PublicPortfolioMedia = {
  id: string;
  media_type: 'image' | 'video';
  caption: string;
};

export function PortfolioMediaSafetyPanel({ media }: { media: PublicPortfolioMedia[] }) {
  const { locale } = useLanguage();
  const text = (en: string, ta: string) => locale === 'ta-IN' ? ta : en;
  if (!media.length) return null;

  return <section className="detail-section" aria-labelledby="portfolio-media-safety-heading">
    <div className="section-heading">
      <div>
        <span className="eyebrow">{text('Safety & reporting', 'Safety & reporting')}</span>
        <h2 id="portfolio-media-safety-heading">{text('Report a work sample', 'Work sample-ஐ report செய்ய')}</h2>
      </div>
      <Badge tone="info">{text('Signed-in users', 'Signed-in users')}</Badge>
    </div>
    <p className="detail-copy">{text(
      'If a public portfolio photo or video appears unsafe, misleading, abusive, or inappropriate, report that specific work sample for platform review. Reporting does not automatically remove the media or suspend the professional.',
      'Public portfolio photo/video unsafe, misleading, abusive அல்லது inappropriate போல இருந்தால் அந்த specific work sample-ஐ platform review-க்கு report செய்யலாம். Report செய்தவுடன் media auto-remove ஆகாது; professional-மும் auto-suspend ஆக மாட்டார்.',
    )}</p>
    <div style={{ display: 'grid', gap: '.75rem' }}>
      {media.map((item) => <Card key={item.id}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">{item.media_type === 'image' ? text('Photo', 'Photo') : text('Video', 'Video')}</span>
            <h3>{item.caption || text('Professional work sample', 'Professional work sample')}</h3>
          </div>
          <MarketplaceReportForm
            targetType="portfolio_media"
            targetId={item.id}
            label={item.media_type === 'image' ? text('Report photo', 'Photo report') : text('Report video', 'Video report')}
          />
        </div>
      </Card>)}
    </div>
  </section>;
}
