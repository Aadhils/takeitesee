'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState, Textarea } from '../ui/primitives';

type ReviewRow = {
  id: string;
  product_id: string;
  business_id: string;
  applicant_user_id: string;
  product_revision: number;
  created_at: string;
  product: {
    id: string;
    name: string;
    description: string | null;
    sku: string | null;
    price: number | string;
    currency: string;
    unit_label: string;
    stock_mode: string;
    status: string;
    review_revision: number;
    has_image: boolean;
    image_url: string | null;
  } | null;
  business: { id: string; name: string | null; verified: boolean } | null;
};

export default function ProductLaunchReviewManager() {
  const [requests, setRequests] = useState<ReviewRow[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/super-admin/product-launches', { cache: 'no-store' });
      const payload = await response.json() as { requests?: ReviewRow[]; error?: string };
      if (!response.ok || !payload.requests) throw new Error(payload.error || 'Unable to load product launch reviews.');
      setRequests(payload.requests);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load product launch reviews.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const review = async (row: ReviewRow, decision: 'approve' | 'changes_requested' | 'reject') => {
    setSavingId(row.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/super-admin/product-launches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: row.id, decision, note: notes[row.id] || null }),
      });
      const payload = await response.json() as { request?: unknown; error?: string };
      if (!response.ok || !payload.request) throw new Error(payload.error || 'Unable to review product launch.');
      setNotes((current) => ({ ...current, [row.id]: '' }));
      setNotice(decision === 'approve' ? 'Product revision approved for public launch.' : 'Product launch review updated.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to review product launch.');
    } finally {
      setSavingId(null);
    }
  };

  return <section style={{ display: 'grid', gap: '1rem' }}>
    {error ? <Alert title="Product launch review error" tone="danger">{error}</Alert> : null}
    {notice ? <Alert tone="success">{notice}</Alert> : null}
    {loading ? <Card><p>Loading product launch reviews…</p></Card> : requests.length ? requests.map((row) => {
      const product = row.product;
      const stale = !product || Number(product.review_revision) !== Number(row.product_revision);
      const amount = product ? `${product.currency} ${Number(product.price).toFixed(2)} / ${product.unit_label}` : 'Product unavailable';
      return <Card key={row.id} style={{ display: 'grid', gap: '.9rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <span className="eyebrow">{row.business?.name || 'Business'} · Revision {row.product_revision}</span>
            <h2 style={{ margin: '.3rem 0' }}>{product?.name || 'Product unavailable'}</h2>
            <p style={{ margin: 0 }} className="muted">{amount}{product?.sku ? ` · SKU ${product.sku}` : ''}</p>
          </div>
          <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
            <Badge tone={row.business?.verified ? 'success' : 'warning'}>{row.business?.verified ? 'Business verified' : 'Business not verified'}</Badge>
            <Badge tone={stale ? 'danger' : 'info'}>{stale ? 'Stale revision' : 'Current revision'}</Badge>
            {product ? <Badge tone={product.status === 'active' ? 'success' : 'neutral'}>{product.status}</Badge> : null}
            {product?.has_image ? <Badge tone="info">Primary image attached</Badge> : <Badge tone="neutral">No primary image</Badge>}
          </div>
        </div>
        {product?.image_url ? <div style={{ display: 'grid', gap: '.4rem' }}>
          <span className="eyebrow">Review-sensitive Product image</span>
          <img
            src={product.image_url}
            alt={`${product.name} Product review preview`}
            style={{ width: 'min(100%, 420px)', maxHeight: '360px', objectFit: 'contain', border: '1px solid var(--color-border)', borderRadius: '14px', background: 'var(--color-surface-subtle, #fafafa)' }}
          />
        </div> : product?.has_image ? <Alert tone="warning">The Product has an image, but its private preview could not be generated. Request changes instead of approving if visual review is required.</Alert> : null}
        {product?.description ? <p style={{ margin: 0, lineHeight: 1.6 }}>{product.description}</p> : null}
        {stale ? <Alert tone="danger">This request cannot be approved because the product revision changed or the product is unavailable.</Alert> : null}
        <Textarea
          label="Review note"
          rows={3}
          maxLength={1200}
          value={notes[row.id] || ''}
          onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))}
          hint="Required for changes requested or rejection; optional for approval."
        />
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
          <Button type="button" disabled={stale || savingId === row.id} loading={savingId === row.id} onClick={() => void review(row, 'approve')}>Approve current revision</Button>
          <Button type="button" variant="secondary" disabled={savingId === row.id} onClick={() => void review(row, 'changes_requested')}>Request changes</Button>
          <Button type="button" variant="quiet" disabled={savingId === row.id} onClick={() => void review(row, 'reject')}>Reject</Button>
        </div>
      </Card>;
    }) : <Card><EmptyState title="No product launch reviews pending">Business product submissions will appear here after Providers request public launch.</EmptyState></Card>}
  </section>;
}
