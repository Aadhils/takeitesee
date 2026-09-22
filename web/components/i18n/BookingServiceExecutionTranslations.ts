'use client';

import { useLanguage, type AppLocale } from './LanguageProvider';

const english = {
  'execution.eyebrow': 'Service execution',
  'execution.badge.prepare': 'Prepare',
  'execution.badge.inService': 'In service',
  'execution.badge.completionDue': 'Completion due',
  'execution.provider.prepare.title': 'Service confirmed — prepare to deliver',
  'execution.provider.prepare.body': 'The customer booking is confirmed. Be ready to start the service at {moment} and coordinate any remaining service details beforehand.',
  'execution.provider.prepare.note': 'The completion action stays locked until the scheduled service window ends.',
  'execution.provider.service.title': 'Service window is now in progress',
  'execution.provider.service.body': 'Deliver the agreed service and keep the customer updated if any coordination is needed.',
  'execution.provider.service.note': 'Scheduled end: {moment}. After that, use “Mark complete” only if the service was actually delivered.',
  'execution.provider.completion.title': 'Service window ended — finish the service record',
  'execution.provider.completion.body': 'If the service was actually delivered, use “Mark complete” in Next action. If anything remains unresolved, keep coordinating instead of closing it.',
  'execution.provider.completion.note': 'Scheduled end: {moment}',
  'execution.customer.prepare.title': 'Booking confirmed — get ready for service',
  'execution.customer.prepare.body': 'Your provider confirmed the booking. Be ready at the service location for {moment}; use the coordination option above if timing or service details need clarification.',
  'execution.customer.prepare.note': 'Next stage: scheduled service.',
  'execution.customer.service.title': 'Service window is now in progress',
  'execution.customer.service.body': 'This is the scheduled service window. Keep coordinating with the provider in the same private conversation if anything needs clarification.',
  'execution.customer.service.note': 'Scheduled end: {moment}',
  'execution.customer.completion.title': 'Scheduled service window has ended',
  'execution.customer.completion.body': 'If the service finished, the provider will update the completion record. If it is still unresolved, keep coordinating and use support if needed.',
  'execution.customer.completion.note': 'Scheduled end: {moment}',
} as const;

export type BookingServiceExecutionKey = keyof typeof english;

const tamil: Record<BookingServiceExecutionKey, string> = {
  'execution.eyebrow': 'சேவை நிறைவேற்றம்',
  'execution.badge.prepare': 'தயார் ஆகவும்',
  'execution.badge.inService': 'சேவை நடைபெறுகிறது',
  'execution.badge.completionDue': 'முடிவு நடவடிக்கை',
  'execution.provider.prepare.title': 'சேவை உறுதி செய்யப்பட்டது — வழங்க தயாராகுங்கள்',
  'execution.provider.prepare.body': 'Customer booking உறுதி செய்யப்பட்டுள்ளது. {moment}க்கு service தொடங்க தயாராக இருந்து, தேவையான service details-ஐ முன்பே coordinate செய்யுங்கள்.',
  'execution.provider.prepare.note': 'Scheduled service window முடியும் வரை completion action lock ஆகவே இருக்கும்.',
  'execution.provider.service.title': 'Service window இப்போது நடைபெறுகிறது',
  'execution.provider.service.body': 'ஒப்புக்கொண்ட service-ஐ வழங்கி, customer உடன் தேவையான coordination-ஐ தொடருங்கள்.',
  'execution.provider.service.note': 'Scheduled end: {moment}. அதன் பிறகு service உண்மையாக வழங்கப்பட்டிருந்தால் மட்டும் “Mark complete” பயன்படுத்துங்கள்.',
  'execution.provider.completion.title': 'Service window முடிந்தது — service record-ஐ முடிக்கவும்',
  'execution.provider.completion.body': 'Service உண்மையாக முடிந்திருந்தால் Next action-ல் “Mark complete” செய்யுங்கள். ஏதேனும் unresolved issue இருந்தால் record-ஐ close செய்யாமல் coordination தொடருங்கள்.',
  'execution.provider.completion.note': 'Scheduled end: {moment}',
  'execution.customer.prepare.title': 'Booking உறுதி செய்யப்பட்டது — service-க்கு தயாராகுங்கள்',
  'execution.customer.prepare.body': 'Provider உங்கள் booking-ஐ உறுதி செய்துள்ளார். {moment}க்கு service location-ல் தயாராக இருங்கள்; timing அல்லது service details பற்றி clarification தேவைப்பட்டால் மேலே உள்ள coordination option-ஐ பயன்படுத்துங்கள்.',
  'execution.customer.prepare.note': 'அடுத்த நிலை: scheduled service.',
  'execution.customer.service.title': 'Service window இப்போது நடைபெறுகிறது',
  'execution.customer.service.body': 'இது scheduled service நேரம். ஏதேனும் clarification தேவைப்பட்டால் Provider உடன் அதே private conversation-ல் coordination தொடருங்கள்.',
  'execution.customer.service.note': 'Scheduled end: {moment}',
  'execution.customer.completion.title': 'Scheduled service window முடிந்தது',
  'execution.customer.completion.body': 'Service முடிந்திருந்தால் Provider completion record-ஐ update செய்வார். Service இன்னும் முடியவில்லை அல்லது issue இருந்தால் coordination தொடருங்கள்; தேவையானால் support பயன்படுத்துங்கள்.',
  'execution.customer.completion.note': 'Scheduled end: {moment}',
};

function interpolate(template: string, values?: Record<string, string | number>) {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

export function useBookingServiceExecutionTranslations() {
  const { locale } = useLanguage();
  const catalog = locale.toLowerCase().startsWith('ta') ? tamil : english;
  return {
    locale: locale as AppLocale,
    t: (key: BookingServiceExecutionKey, values?: Record<string, string | number>) => interpolate(catalog[key], values),
  };
}
