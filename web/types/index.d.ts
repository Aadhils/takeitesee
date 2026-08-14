/**
 * TakeItEsee Type Definitions
 *
 * Phase 6A Step 1 - Foundational Domain Layer
 *
 * This module exports all canonical types and contracts for the TakeItEsee platform,
 * following the approved Phase 6 Implementation Blueprint.
 */

// Entity types
export * from './entities';

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

// CSS Modules
declare module '*.module.css';
declare module '*.module.scss';
