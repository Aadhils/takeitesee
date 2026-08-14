/**
 * TakeItEsee Type Definitions
 *
 * Phase 6A Step 1 - Foundational Domain Layer
 * Phase 6B - Authentication, Session & Role Foundation
 *
 * This module exports all canonical types and contracts for the TakeItEsee platform,
 * following the approved Phase 6 Implementation Blueprint.
 */

// === Phase 6A: Domain Foundation ===

// Entity types
export * from './entities';

// Service and catalog foundation
export * from './catalog';

// Ownership and role model
export * from './ownership';

// Money and currency
export * from './money';

// Payment lifecycle
export * from './payment';

// Booking lifecycle
export * from './booking';

// Verification domain
export * from './verification';

// Provider-agnostic payment adapters
export * from './payment-adapter';

// Notifications, reviews, and operational summaries
export * from './notifications';
export * from './reviews';
export * from './operations';

// === Phase 6B: Authentication, Session & Role Foundation ===

// Authentication domain types
export * from './auth';

// Session management types
export * from './session';

// Authorization and policy types
export * from './authorization';

// Server-side authentication/authorization service interfaces
export * from './auth-services';

// CSS Modules
declare module '*.module.css';
declare module '*.module.scss';
