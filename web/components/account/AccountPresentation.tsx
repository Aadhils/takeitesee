'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Card, Checkbox, EmptyState, Input, Select, Textarea } from '../ui/primitives';
import { BookingCard } from '../booking/BookingPresentation';
import { discoveryBookings, discoveryCustomerProfile, discoveryCustomerReviews, discoveryNotifications, discoveryServices, displayText, type DiscoveryCustomerReview, type DiscoveryNotification } from '../../data/discovery-fixtures';
import type { NotificationStatus, NotificationType } from '../../types/notifications';
import type { ReviewStatus } from '../../types/reviews';
import { Rating } from '../discovery/MarketplaceCards';

const accountLinks = [
  { href: '/account', label: 'Overview' },
  { href: '/account/profile', label: 'Profile' },
  { href: '/account/settings', label: 'Settings' },
  { href: '/notifications', label: 'Notifications' },
  { href: '/reviews', label: 'Reviews' },
  { href: '/help', label: 'Help center' },
];

export function AccountShell({ children, active }: { children: React.ReactNode; active: string }) {
  return <div className="account-layout"><aside className="account-sidebar"><div className="account-sidebar-heading"><div className="provider-avatar account-avatar" aria-hidden="true">AS</div><div><strong>{discoveryCustomerProfile.display_name}</strong><span>Customer account</span></div></div><nav aria-label="Customer account navigation">{accountLinks.map((link) => <Link href={link.href} className={active === link.href ? 'account-nav-active' : ''} aria-current={active === link.href ? 'page' : undefined} key={link.href}>{link.label}{link.href === '/notifications' ? <span className="account-nav-count">1</span> : null}</Link>)}</nav></aside><main className="account-content">{children}</main></div>;
}

export function ProfileSummary({ compact = false }: { compact?: boolean }) {
  return <Card className={`profile-summary ${compact ? 'profile-summary-compact' : ''}`}><div className="provider-avatar provider-avatar-large" aria-hidden="true">AS</div><div><span className="eyebrow">Customer profile</span><h2>{discoveryCustomerProfile.display_name}</h2><p>{discoveryCustomerProfile.email}</p><span className="card-location">{discoveryCustomerProfile.location}</span></div>{!compact ? <Badge tone="info">{discoveryCustomerProfile.profile_completion}% complete</Badge> : null}</Card>;
}

const notificationLabels: Record<NotificationType, string> = { booking_created: 'Booking', booking_accepted: 'Booking', booking_rejected: 'Booking', booking_rescheduled: 'Booking', booking_cancelled: 'Booking', service_completed: 'Service', payment_status_changed: 'Payment', refund_status_changed: 'Payment', dispute_status_changed: 'Payment', review_requested: 'Review', provider_operational_alert: 'Provider', business_operational_alert: 'Provider' };

export function NotificationCard({ notification, onToggle }: { notification: DiscoveryNotification; onToggle?: (id: string) => void }) {
  const unread = notification.status === 'pending';
  const href = notification.reference_type === 'booking' && notification.reference_id ? `/bookings/${notification.reference_id}` : notification.reference_type === 'review' && notification.reference_id ? `/bookings/${notification.reference_id}` : '/notifications';
  return <Card className={`notification-card ${unread ? 'notification-unread' : ''}`}><div className="notification-card-mark" aria-hidden="true">{notificationLabels[notification.type].slice(0, 1)}</div><div className="notification-card-body"><div className="notification-card-top"><Badge tone={unread ? 'info' : 'neutral'}>{notificationLabels[notification.type]}</Badge><time>{notification.created_label}</time></div><h2>{notification.title}</h2><p>{notification.body}</p><div className="notification-card-actions"><Link href={href} className="text-link">{notification.reference_type === 'booking' ? 'View booking' : notification.reference_type === 'review' ? 'View review' : 'View notification'}</Link>{onToggle && unread ? <Button type="button" variant="quiet" onClick={() => onToggle(notification.id)}>Mark as read</Button> : null}</div></div></Card>;
}

export function NotificationsPage() {
  const [items, setItems] = useState(discoveryNotifications);
  const markRead = (id: string) => setItems((current) => current.map((item) => item.id === id ? { ...item, status: 'read' as NotificationStatus } : item));
  return <AccountShell active="/notifications"><section className="account-page-heading"><span className="eyebrow">Customer account</span><h1>Notifications</h1><p>Fixture updates for bookings, payments, services, and reviews. Delivery and read state are not connected to a live account.</p></section><div className="notification-toolbar"><Badge tone="info">{items.filter((item) => item.status === 'pending').length} unread</Badge><span className="results-note">Presentation-only inbox</span></div>{items.length ? <div className="notification-list">{items.map((item) => <NotificationCard notification={item} onToggle={markRead} key={item.id} />)}</div> : <Card><EmptyState title="No notifications">New account updates will appear here.</EmptyState></Card>}</AccountShell>;
}

function reviewStatusLabel(status: ReviewStatus) { return status === 'published' ? 'Published' : status === 'draft' ? 'Draft preview' : status.replace('_', ' '); }

export function RatingInput({ value, onChange }: { value: number; onChange: (value: 1 | 2 | 3 | 4 | 5) => void }) {
  return <div className="rating-input" role="radiogroup" aria-label="Rating"><span className="field-label">Your rating</span><div>{([1, 2, 3, 4, 5] as const).map((rating) => <button type="button" role="radio" aria-checked={value === rating} className={value >= rating ? 'rating-selected' : ''} onClick={() => onChange(rating)} key={rating}>{rating} <span aria-hidden="true">★</span><span className="sr-only">{rating} out of 5</span></button>)}</div></div>;
}

export function ReviewForm({ bookingId }: { bookingId: string }) {
  const booking = discoveryBookings.find((item) => item.id === bookingId);
  const service = booking ? discoveryServices.find((item) => item.id === booking.service_id) : undefined;
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  if (!booking || !service) return <Card><EmptyState title="Booking unavailable">This presentation fixture is no longer available.</EmptyState></Card>;
  return <Card className="review-form"><span className="eyebrow">Presentation-only review</span><h2>{displayText(service.service_name)}</h2><p>{booking.provider_name} · {booking.booking_reference}</p><RatingInput value={rating} onChange={setRating} /><Textarea label="Your review" hint="This text remains local and will not be submitted." placeholder="What stood out about the service?" value={comment} onChange={(event) => setComment(event.target.value)} /><Button type="button" disabled={!rating || !comment.trim()} onClick={() => undefined}>Preview review</Button><p className="explore-disclaimer">Review submission is not available in this presentation phase.</p></Card>;
}

export function ReviewsPage() {
  const eligible = discoveryBookings.filter((booking) => booking.review_eligible);
  return <AccountShell active="/reviews"><section className="account-page-heading"><span className="eyebrow">Customer account</span><h1>Reviews</h1><p>Keep track of reviews you have written and completed fixture bookings that are eligible for a review.</p></section><section className="account-section"><div className="section-heading"><div><span className="eyebrow">Write a review</span><h2>Eligible bookings</h2></div><Badge tone="info">{eligible.length} eligible</Badge></div>{eligible.length ? <div className="eligible-review-list">{eligible.map((booking) => { const service = discoveryServices.find((item) => item.id === booking.service_id); return <Card className="eligible-review-card" key={booking.id}><div><h3>{service ? displayText(service.service_name) : 'Completed service'}</h3><p>{booking.provider_name} · {booking.date_label}</p><Badge tone="success">Completed booking</Badge></div><Link href={`/reviews/${booking.id}`} className="button button-primary">Leave a review</Link></Card>; })}</div> : <Card><EmptyState title="No eligible reviews">Completed eligible bookings will appear here.</EmptyState></Card>}</section><section className="account-section"><div className="section-heading"><div><span className="eyebrow">Your voice</span><h2>Reviews written</h2></div><Badge tone="neutral">{discoveryCustomerReviews.length} shown</Badge></div>{discoveryCustomerReviews.length ? <div className="customer-review-list">{discoveryCustomerReviews.map((review) => <CustomerReviewCard review={review} key={review.id} />)}</div> : <Card><EmptyState title="No reviews yet">Your published reviews will appear here.</EmptyState></Card>}</section></AccountShell>;
}

function CustomerReviewCard({ review }: { review: DiscoveryCustomerReview }) { return <Card className="customer-review-card"><div className="review-card-top"><div><h3>{review.service_name}</h3><span>{review.provider_name}</span></div><Badge tone={review.status === 'published' ? 'success' : 'neutral'}>{reviewStatusLabel(review.status)}</Badge></div><Rating value={review.rating} count={0} /><p>{review.comment}</p><time>{review.date_label}</time></Card>; }

export function ProfilePage() {
  return <AccountShell active="/account/profile"><section className="account-page-heading"><span className="eyebrow">Account profile</span><h1>Your profile</h1><p>A presentation view of the information customers may use to manage their account and service preferences.</p></section><ProfileSummary /><div className="profile-detail-grid"><Card><span className="eyebrow">Identity</span><h2>Contact details</h2><dl className="account-details"><div><dt>Name</dt><dd>{discoveryCustomerProfile.display_name}</dd></div><div><dt>Email</dt><dd>{discoveryCustomerProfile.email}</dd></div><div><dt>Phone</dt><dd>{discoveryCustomerProfile.phone}</dd></div><div><dt>Location</dt><dd>{discoveryCustomerProfile.location}</dd></div></dl><Button type="button" variant="secondary" onClick={() => undefined}>Edit profile</Button><p className="explore-disclaimer">Editing is presentation-only. Changes are not persisted.</p></Card><Card><span className="eyebrow">Preferences</span><h2>Service regions</h2><div className="profile-region-list">{discoveryCustomerProfile.service_regions.map((region) => <Badge tone="neutral" key={region}>{region}</Badge>)}</div><dl className="account-details"><div><dt>Preferred language</dt><dd>{discoveryCustomerProfile.preferred_language}</dd></div><div><dt>Member since</dt><dd>{discoveryCustomerProfile.member_since}</dd></div></dl></Card></div></AccountShell>;
}

export function SettingsPage() {
  const [saved, setSaved] = useState(false);
  return <AccountShell active="/account/settings"><section className="account-page-heading"><span className="eyebrow">Account settings</span><h1>Settings</h1><p>Review presentation preferences. Nothing on this page changes a live account.</p></section>{saved ? <div className="alert alert-success" role="status"><strong>Preferences preview updated.</strong><span>These changes exist only in this browser session.</span></div> : null}<div className="settings-grid"><Card className="settings-section"><span className="eyebrow">Communication</span><h2>Notification preferences</h2><Checkbox label="Booking updates" description="Show schedule and status updates in the presentation inbox." defaultChecked /><Checkbox label="Review reminders" description="Show reminders after a completed fixture booking." defaultChecked /><Checkbox label="Product information" description="Show occasional platform information." /></Card><Card className="settings-section"><span className="eyebrow">Experience</span><h2>Language and accessibility</h2><Select label="Language" defaultValue="English"><option>English</option><option>Tamil</option><option>Hindi</option><option>Malayalam</option></Select><Checkbox label="Reduced motion" description="Prefer less animation where supported." /><Checkbox label="Larger text" description="Preview a more spacious reading scale." /></Card><Card className="settings-section"><span className="eyebrow">Privacy</span><h2>Account visibility</h2><Checkbox label="Use service history for recommendations" description="Presentation preference only; no data is shared from this fixture." defaultChecked /><p className="settings-note">Privacy controls and account security actions will require authenticated, server-backed behavior later.</p></Card><Card className="settings-section settings-danger"><span className="eyebrow">Danger zone</span><h2>Account actions</h2><p>Account deletion and password changes are unavailable in this presentation phase.</p><Button type="button" variant="danger" disabled>Delete account</Button></Card></div><Button type="button" onClick={() => setSaved(true)}>Preview preference changes</Button></AccountShell>;
}

export function AccountOverviewPage() {
  const upcoming = discoveryBookings.find((booking) => booking.status === 'scheduled' || booking.status === 'provider_review');
  return <AccountShell active="/account"><section className="account-page-heading"><span className="eyebrow">Welcome back</span><h1>{discoveryCustomerProfile.display_name.split(' ')[0]}'s account</h1><p>One place for bookings, notifications, reviews, and presentation preferences.</p></section><ProfileSummary compact /><div className="account-overview-grid"><Card><span className="eyebrow">Next up</span><h2>Upcoming booking</h2>{upcoming ? <BookingCard booking={upcoming} /> : <EmptyState title="No upcoming bookings">Explore services to find your next appointment.</EmptyState>}</Card><Card><span className="eyebrow">Stay informed</span><h2>Recent notifications</h2><div className="overview-notifications">{discoveryNotifications.slice(0, 2).map((notification) => <div key={notification.id}><Badge tone={notification.status === 'pending' ? 'info' : 'neutral'}>{notificationLabels[notification.type]}</Badge><strong>{notification.title}</strong><span>{notification.created_label}</span></div>)}</div><Link href="/notifications" className="text-link">View all notifications</Link></Card><Card><span className="eyebrow">Your voice</span><h2>Review progress</h2><p>{discoveryBookings.filter((booking) => booking.review_eligible).length} completed booking ready for a presentation review.</p><Link href="/reviews" className="button button-secondary">Open reviews</Link></Card></div></AccountShell>;
}

export function HelpPage() {
  const topics = [{ title: 'Booking help', body: 'Understand selection, provider review, scheduling, and fixture booking status.', href: '/bookings' }, { title: 'Payment status', body: 'Learn why booking and payment status are displayed separately.', href: '/bookings' }, { title: 'Cancellation and rescheduling', body: 'Review the policy shown on each service and booking detail page.', href: '/explore' }, { title: 'Account and profile', body: 'Review presentation profile, preferences, and account controls.', href: '/account/profile' }, { title: 'Provider and service issues', body: 'Find service details, provider information, and trust presentation.', href: '/professionals' }, { title: 'Safety and trust', body: 'Use verification labels as presentation metadata; server policy will remain authoritative later.', href: '/professionals' }];
  return <AccountShell active="/help"><section className="account-page-heading"><span className="eyebrow">Support</span><h1>Help center</h1><p>Clear guidance for the customer journey. Support contact and case management are not connected yet.</p></section><div className="help-topic-grid">{topics.map((topic) => <Card className="help-topic-card" key={topic.title}><span className="help-topic-mark" aria-hidden="true">?</span><h2>{topic.title}</h2><p>{topic.body}</p><Link href={topic.href} className="text-link">Explore topic</Link></Card>)}</div><Card className="faq-card"><span className="eyebrow">Frequently asked</span><h2>Common questions</h2><FAQItem question="Are these bookings real?" answer="No. All account, booking, notification, and review information in this phase is local presentation data." /><FAQItem question="Can I change my profile?" answer="You can preview the profile and settings controls, but changes are not persisted." /><FAQItem question="How do I contact support?" answer="A contact-support workflow will be added when authenticated support infrastructure is approved." /></Card><Card className="support-cta"><h2>Still need help?</h2><p>Support contact is a future workflow. This button is intentionally presentation-only.</p><Button type="button" variant="secondary" disabled>Contact support</Button></Card></AccountShell>;
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return <div className="faq-item"><button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}><span>{question}</span><span aria-hidden="true">{open ? '-' : '+'}</span></button>{open ? <p>{answer}</p> : null}</div>;
}
