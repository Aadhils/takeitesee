import { ApiError, apiFetch } from './api';
import { supabase } from './supabase';
export type ServiceStatus = 'draft' | 'active' | 'paused';
export type OwnedService = { id: string; provider_type: 'professional' | 'business'; name: string; description: string; category: string | null; location: string | null; duration_minutes: number; base_price: number; currency: 'INR' | 'USD'; status: ServiceStatus; public_discoverable?: boolean | null };
export type ServiceCategory = { id: string; name: string; parent_id: string | null; application_id: string; code: string };
export type ServiceDraft = { name: string; description: string; categoryId: string; location: string; duration: string; price: string; currency: 'INR' | 'USD' };
type LaunchOptions = { applications: { id: string; code: string }[]; categories: ServiceCategory[] };
export class ServiceSaveUncertainError extends Error {}
async function token(userId: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== userId) throw new Error('Sign in again to manage your services.');
  return data.session.access_token;
}
export function serviceCategories(options: LaunchOptions): ServiceCategory[] {
  const applications = new Set(options.applications.filter((item) => item.code === 'services').map((item) => item.id));
  const parents = new Set(options.categories.map((item) => item.parent_id).filter(Boolean));
  return options.categories.filter((item) => applications.has(item.application_id) && !parents.has(item.id) && !!item.code.trim());
}
export async function fetchOwnedServices(userId: string, scope: OwnedService['provider_type']) {
  const accessToken = await token(userId);
  const result = await apiFetch<{ services: OwnedService[] }>('/api/provider/services', { accessToken });
  await token(userId);
  if (!Array.isArray(result.services) || result.services.some((item) => item.provider_type !== scope)) throw new Error('Your Provider services could not be verified.');
  return result.services;
}
export async function fetchServiceCategories(userId: string) {
  await token(userId);
  const { data, error } = await supabase.rpc('get_provider_launch_options');
  await token(userId);
  if (error || !data || !Array.isArray(data.categories) || !Array.isArray(data.applications)) throw new Error('Service categories could not load. Please retry.');
  return serviceCategories(data as LaunchOptions);
}
export function serviceInput(draft: ServiceDraft, categories: ServiceCategory[], creating: boolean) {
  const name = draft.name.trim(), description = draft.description.trim();
  if (!name || name.length > 200) throw new Error('Enter a service name up to 200 characters.');
  if (!description || description.length > 4000) throw new Error('Enter a description up to 4000 characters.');
  if (!/^\d+$/.test(draft.duration.trim()) || !Number.isSafeInteger(Number(draft.duration)) || Number(draft.duration) <= 0) throw new Error('Enter a positive whole number of minutes.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(draft.price.trim()) || !Number.isFinite(Number(draft.price)) || Number(draft.price) < 0) throw new Error('Enter a price of zero or more, with up to two decimal places.');
  if (draft.location.trim().length > 160) throw new Error('Location must be 160 characters or fewer.');
  if (!['INR', 'USD'].includes(draft.currency)) throw new Error('Choose INR or USD.');
  if ((creating || draft.categoryId) && !categories.some((category) => category.id === draft.categoryId)) throw new Error('Choose an available Services specialty category.');
  return { name, description, ...(draft.categoryId ? { category_id: draft.categoryId } : {}), location: draft.location.trim(), duration_minutes: Number(draft.duration), base_price: Number(draft.price), currency: draft.currency, ...(creating ? { status: 'draft' as const } : {}) };
}
export async function saveOwnedService(userId: string, scope: OwnedService['provider_type'], draft: ServiceDraft, categories: ServiceCategory[], serviceId?: string) {
  const input = serviceInput(draft, categories, !serviceId);
  if (serviceId && !(await fetchOwnedServices(userId, scope)).some((item) => item.id === serviceId)) throw new Error('This service is not available in your Provider profile.');
  const accessToken = await token(userId);
  try {
    const { service } = await apiFetch<{ service: OwnedService }>(serviceId ? `/api/provider/services/${encodeURIComponent(serviceId)}` : '/api/provider/services', { method: serviceId ? 'PATCH' : 'POST', accessToken, body: JSON.stringify(input) });
    await token(userId);
    if (!service || service.provider_type !== scope || !service.id || (serviceId && service.id !== serviceId)) throw new Error('The saved service could not be verified.');
    return service;
  } catch (cause) {
    if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500) throw cause;
    throw new ServiceSaveUncertainError('The save could not be confirmed. Reload services and check the list before trying again.');
  }
}
