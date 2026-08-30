'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card } from '../ui/primitives';
import { MarketplaceReportForm } from '../safety/MarketplaceReportForm';
import { useOperationalTranslations } from '../i18n/OperationalTranslations';

type ConversationSummary = {
  id: string;
  requirement_id: string;
  requirement_reference: string;
  requirement_title: string;
  requirement_status: string;
  conversation_status: 'open' | 'closed';
  closed_reason: 'fulfilled' | 'cancelled' | null;
  participant_role: 'customer' | 'provider';
  counterpart_name: string;
  proposal_reference: string;
  amount_minor: number;
  currency: 'INR' | 'USD';
  service_name: string;
  last_message_body: string | null;
  last_message_at: string | null;
  opened_at: string;
  unread_count: number;
};

type MessageRow = { id: string; body: string; created_at: string; is_mine: boolean; sender_name: string };
type ConversationDetail = {
  id: string; requirement_id: string; requirement_reference: string; requirement_title: string; requirement_status: string;
  conversation_status: 'open' | 'closed'; closed_reason: 'fulfilled' | 'cancelled' | null; participant_role: 'customer' | 'provider';
  counterpart_name: string; proposal_reference: string; amount_minor: number; currency: 'INR' | 'USD'; service_name: string; opened_at: string; last_message_at: string | null;
};
type ConversationPayload = { conversation?: ConversationDetail; messages?: MessageRow[]; error?: string };
type SafetyState = { blocked_by_me: boolean; messaging_blocked: boolean };

export function MarketplaceMessagingWorkspace({ initialConversationId = '' }: { initialConversationId?: string }) {
  const { locale, t, status } = useOperationalTranslations();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState(initialConversationId);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [safety, setSafety] = useState<SafetyState>({ blocked_by_me: false, messaging_blocked: false });
  const [draft, setDraft] = useState('');
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [error, setError] = useState('');

  const money = (minor: number, currency: 'INR' | 'USD') => new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(minor) / 100);
  const activityLabel = (value: string | null, fallback: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value || fallback));

  const loadInbox = useCallback(async (silent = false) => {
    if (!silent) setLoadingInbox(true);
    try {
      const response = await fetch('/api/messages', { cache: 'no-store' });
      const payload = await response.json() as { conversations?: ConversationSummary[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Message inbox could not be loaded.');
      const rows = payload.conversations ?? [];
      setConversations(rows); setSelectedId((current) => current || rows[0]?.id || ''); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Message inbox could not be loaded.'); }
    finally { if (!silent) setLoadingInbox(false); }
  }, []);

  const loadSafety = useCallback(async (conversationId: string) => {
    if (!conversationId) { setSafety({ blocked_by_me: false, messaging_blocked: false }); return; }
    const response = await fetch(`/api/messages/${encodeURIComponent(conversationId)}/safety`, { cache: 'no-store' });
    const payload = await response.json() as { safety?: SafetyState; error?: string };
    if (!response.ok) throw new Error(payload.error || 'Conversation safety state could not be loaded.');
    setSafety(payload.safety ?? { blocked_by_me: false, messaging_blocked: false });
  }, []);

  const loadThread = useCallback(async (conversationId: string, silent = false) => {
    if (!conversationId) { setDetail(null); setMessages([]); return; }
    if (!silent) setLoadingThread(true);
    try {
      const response = await fetch(`/api/messages/${encodeURIComponent(conversationId)}`, { cache: 'no-store' });
      const payload = await response.json() as ConversationPayload;
      if (!response.ok || !payload.conversation) throw new Error(payload.error || 'Conversation could not be loaded.');
      setDetail(payload.conversation); setMessages(payload.messages ?? []);
      setConversations((current) => current.map((row) => row.id === conversationId ? { ...row, unread_count: 0 } : row));
      await loadSafety(conversationId); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Conversation could not be loaded.'); }
    finally { if (!silent) setLoadingThread(false); }
  }, [loadSafety]);

  useEffect(() => { void loadInbox(); }, [loadInbox]);
  useEffect(() => { if (selectedId) void loadThread(selectedId); }, [loadThread, selectedId]);
  useEffect(() => { const id = window.setInterval(() => void loadInbox(true), 10000); return () => window.clearInterval(id); }, [loadInbox]);
  useEffect(() => { if (!selectedId) return; const id = window.setInterval(() => void loadThread(selectedId, true), 5000); return () => window.clearInterval(id); }, [loadThread, selectedId]);

  const unreadTotal = useMemo(() => conversations.reduce((sum, row) => sum + Number(row.unread_count || 0), 0), [conversations]);
  const selectConversation = (conversationId: string) => { setSelectedId(conversationId); if (typeof window !== 'undefined') { const url = new URL(window.location.href); url.searchParams.set('conversation', conversationId); window.history.replaceState({}, '', `${url.pathname}${url.search}`); } };

  const send = async () => {
    const body = draft.trim();
    if (!selectedId || !body || sending || safety.messaging_blocked || detail?.conversation_status !== 'open') return;
    setSending(true); setError('');
    try {
      const response = await fetch(`/api/messages/${encodeURIComponent(selectedId)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idempotency_key: crypto.randomUUID(), message: body }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Message could not be sent.');
      setDraft(''); await Promise.all([loadThread(selectedId, true), loadInbox(true)]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Message could not be sent.'); }
    finally { setSending(false); }
  };

  const toggleBlock = async () => {
    if (!selectedId || safetyBusy) return;
    setSafetyBusy(true); setError('');
    try {
      const response = await fetch(`/api/messages/${encodeURIComponent(selectedId)}/safety`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blocked: !safety.blocked_by_me, reason: safety.blocked_by_me ? '' : 'User blocked further marketplace messaging in this conversation.' }) });
      const payload = await response.json() as { safety?: SafetyState; error?: string };
      if (!response.ok || !payload.safety) throw new Error(payload.error || 'Block setting could not be updated.');
      setSafety(payload.safety);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Block setting could not be updated.'); }
    finally { setSafetyBusy(false); }
  };

  return <div style={{ display: 'grid', gap: '1rem' }}>
    <div className="section-heading"><div><span className="eyebrow">{t('msg.privateInbox')}</span><h1>{t('msg.title')}</h1><p className="detail-copy">{t('msg.intro')}</p></div><Badge tone={unreadTotal ? 'info' : 'neutral'}>{unreadTotal} {t('msg.unread')}</Badge></div>
    {error ? <Alert title={t('msg.unavailable')} tone="danger">{error}</Alert> : null}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: '1rem', alignItems: 'start' }}>
      <Card className="policy-card">
        <div className="section-heading"><div><span className="eyebrow">{t('msg.inbox')}</span><h2>{t('msg.conversations')}</h2></div><Badge tone="neutral">{conversations.length}</Badge></div>
        <div style={{ display: 'grid', gap: '.65rem', marginTop: '1rem' }}>
          {loadingInbox ? <p>{t('msg.loadingInbox')}</p> : null}
          {!loadingInbox && conversations.length === 0 ? <p className="detail-copy">{t('msg.none')}</p> : null}
          {conversations.map((row) => <button key={row.id} type="button" onClick={() => selectConversation(row.id)} style={{ textAlign: 'left', border: selectedId === row.id ? '2px solid currentColor' : '1px solid #e7eaf0', borderRadius: '14px', padding: '.9rem', background: 'transparent', cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.75rem', alignItems: 'start' }}><strong>{row.counterpart_name}</strong>{row.unread_count ? <Badge tone="info">{row.unread_count}</Badge> : <Badge tone={row.conversation_status === 'open' ? 'success' : 'neutral'}>{status(row.conversation_status)}</Badge>}</div>
            <p style={{ margin: '.35rem 0 0' }}>{row.requirement_title}</p><p className="summary-note" style={{ margin: '.35rem 0 0' }}>{row.last_message_body || `${row.service_name} · ${row.proposal_reference}`}</p><small>{activityLabel(row.last_message_at, row.opened_at)}</small>
          </button>)}
        </div>
      </Card>
      <Card className="policy-card">
        {!selectedId ? <div><span className="eyebrow">{t('msg.conversation')}</span><h2>{t('msg.select')}</h2><p className="detail-copy">{t('msg.selectHelp')}</p></div> : loadingThread && !detail ? <p>{t('msg.loadingThread')}</p> : detail ? <>
          <div className="section-heading"><div><span className="eyebrow">{detail.requirement_reference}</span><h2>{detail.counterpart_name}</h2><p className="summary-note">{detail.service_name} · {money(detail.amount_minor, detail.currency)}</p></div><Badge tone={detail.conversation_status === 'open' ? 'success' : 'neutral'}>{status(detail.conversation_status)}</Badge></div>
          <p className="detail-copy">{detail.requirement_title}</p>
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'start', marginBottom: '.65rem' }}><Button type="button" variant={safety.blocked_by_me ? 'secondary' : 'danger'} loading={safetyBusy} onClick={() => void toggleBlock()}>{safety.blocked_by_me ? `${t('msg.unblock')} ${detail.counterpart_name}` : `${t('msg.block')} ${detail.counterpart_name}`}</Button><MarketplaceReportForm targetType="conversation" targetId={detail.id} label={t('msg.reportConversation')} /></div>
          {safety.messaging_blocked ? <Alert title={t('msg.blocked')} tone="warning">{t('msg.blockedHelp')}</Alert> : null}
          <div style={{ display: 'grid', gap: '.65rem', maxHeight: '55vh', overflowY: 'auto', padding: '.5rem 0', marginTop: '.5rem' }}>
            {messages.length === 0 ? <p className="summary-note">{t('msg.noMessages')}</p> : null}
            {messages.map((message) => <div key={message.id} style={{ display: 'flex', justifyContent: message.is_mine ? 'flex-end' : 'flex-start' }}><div style={{ maxWidth: '82%', border: '1px solid #e7eaf0', borderRadius: '14px', padding: '.7rem .85rem' }}><strong style={{ display: 'block', fontSize: '.82rem' }}>{message.is_mine ? t('common.you') : message.sender_name}</strong><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '.25rem 0' }}>{message.body}</p><small>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(message.created_at))}</small>{!message.is_mine ? <div style={{ marginTop: '.35rem' }}><MarketplaceReportForm targetType="message" targetId={message.id} label={t('msg.reportMessage')} /></div> : null}</div></div>)}
          </div>
          {detail.conversation_status === 'open' && detail.requirement_status === 'awarded' && !safety.messaging_blocked ? <div style={{ display: 'grid', gap: '.65rem', marginTop: '1rem' }}><label className="field"><span className="field-label">{t('msg.message')}</span><textarea className="field-control field-textarea" rows={3} maxLength={2000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`${t('msg.message')} ${detail.counterpart_name}`} /></label><div style={{ display: 'flex', justifyContent: 'space-between', gap: '.75rem', alignItems: 'center' }}><span className="summary-note">{draft.length}/2000</span><Button type="button" loading={sending} disabled={!draft.trim()} onClick={() => void send()}>{t('msg.send')}</Button></div></div> : detail.conversation_status !== 'open' || detail.requirement_status !== 'awarded' ? <Alert title={t('msg.readOnly')} tone="info">{t('msg.readOnlyPrefix')} {status(detail.closed_reason || detail.requirement_status)}. {t('msg.readOnlySuffix')}</Alert> : null}
        </> : <p>{t('msg.threadUnavailable')}</p>}
      </Card>
    </div>
  </div>;
}
