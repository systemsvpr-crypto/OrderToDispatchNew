# Supabase Migration Activity Log

This document summarizes the changes made during the migration from Google Sheets to Supabase.

## 1. Database Schema
The following tables were established in Supabase:

### Master Data
*   `master_products`: Central list of items.
*   `master_godowns`: Warehouse locations.
*   `master_employees`: Staff and CRM names.
*   `master_customers`: Client list.
*   `master_transporters`: Transport vendors.
*   `master_vendors`: Product suppliers.

### Application Tables
*   `app_orders`: Stores customer orders.
*   `stock_levels`: Real-time inventory levels by item and godown.
*   `dispatch_plans`: Central table for planning, tracking informed status, and dispatch completion.

---

## 2. Refactored Modules

### Order Management (`Order.jsx`)
*   **Source Switch**: Now fetches dropdown data (Clients, Godowns, Items) from `master_*` tables.
*   **Smart Stock**: Implemented real-time, case-insensitive stock lookups that handle extra spaces and naming mismatches.
*   **Submission**: Orders are now inserted into `app_orders` with proper numeric casting for rate and qty.

### Dispatch Planning (`DispatchPlanning.jsx`)
*   **Order Lookup**: Pulls pending orders from `app_orders`.
*   **Saving**: Creates a link between the order and the new `dispatch_plans` entry.
*   **Stock Integration**: Shows real-time stock availability during planning.

### Inform To Party (`InformToParty.jsx`)
*   **Tracking**: Added columns to `dispatch_plans` to track "Informed Before Dispatch" status.
*   **History**: Implemented a history view showing exactly when each party was informed (with timestamps).

### Dispatch Completed (`DispatchComplete.jsx`)
*   **Cycle Completion**: Added `dispatch_completed` and `completed_at` to the plans.
*   **Audit Trail**: Automatically logs the completion time and user when a dispatch is marked as finished.

---

## 3. Key Technical Fixes
*   **PGRST204 Errors**: Fixed schema cache issues by providing SQL commands to add missing columns and refresh PostgREST.
*   **RLS Policies**: Implemented public access policies for development to allow seamless front-end communication.
*   **Data Integrity**: Replaced text-based row lookups with UUID keys for 100% reliable record matching.

---
**Status: Migration of core Dispatch cycle is complete.**
