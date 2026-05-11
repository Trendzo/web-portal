import { createBrowserRouter, Navigate } from 'react-router-dom';
import Landing from './landing';
import AdminLogin from './admin/login';
import AdminLayout from './admin/layout';
import AdminDashboard from './admin/dashboard';
import AdminRetailers from './admin/retailers';
import AdminCollections from './admin/collections';
import AdminCollectionDetail from './admin/collection-detail';
import AdminCategories from './admin/categories';
import AdminBrands from './admin/brands';
import RetailerLogin from './retailer/login';
import RetailerLayout from './retailer/layout';
import RetailerDashboard from './retailer/dashboard';
import RetailerStorePage from './retailer/store';
import RetailerListings from './retailer/listings';
import RetailerListingDetail from './retailer/listing-detail';
import RetailerInventory from './retailer/inventory';
import RetailerBrands from './retailer/brands';
import AdminPromotions from './admin/promotions';
import AdminPromotionNew from './admin/promotion-new';
import AdminPromotionDetail from './admin/promotion-detail';
import AdminClubbing from './admin/clubbing';
import AdminLoyalty from './admin/loyalty';
import AdminConsumers from './admin/consumers';
import AdminConsumerDetail from './admin/consumer-detail';
import AdminPromotionPreview from './admin/promotion-preview';
import RetailerPromotions from './retailer/promotions';
import RetailerPromotionNew from './retailer/promotion-new';
import RetailerPromotionDetail from './retailer/promotion-detail';
import AdminOrdersList from './admin/orders/list';
import AdminPlaceTestOrder from './admin/orders/place';
import AdminOrderDetail from './admin/orders/detail';
import RetailerOrdersList from './retailer/orders/list';
import RetailerOrderDetail from './retailer/orders/detail';
import AdminRefunds from './admin/refunds';
import AdminHeldItems from './admin/held-items';
import AdminIssues from './admin/issues';
import RetailerHeldItems from './retailer/held-items';
import RetailerIssues from './retailer/issues';
import RetailerStaff from './retailer/staff';
import RetailerStaffDetail from './retailer/staff-detail';
import AdminAdmins from './admin/admins';
import AdminSubRoles from './admin/sub-roles';
import AdminApplications from './admin/applications';
import AdminApplicationsDetail from './admin/applications-detail';
import AdminRetailerDetail from './admin/retailer-detail';
import RetailerApplication from './retailer/application';
import RetailerApplicationStatus from './retailer/application-status';
import RetailerKyc from './retailer/kyc';
import RetailerChangeRequests from './retailer/change-requests';
import AdminCompliance from './admin/compliance';
import AdminComplianceDetail from './admin/compliance-detail';
import AdminPolicyEnforcement from './admin/policy-enforcement';
import AdminDataExports from './admin/data-exports';
import AdminAccountDeletions from './admin/account-deletions';
import AdminCatalogModeration from './admin/catalog-moderation';
import AdminListingDetail from './admin/listing-detail';
import RetailerHolidayCalendar from './retailer/holiday-calendar';
import RetailerNotificationPrefs from './retailer/notification-prefs';
import RetailerInbox from './retailer/inbox';
import RetailerAttributeTemplates from './retailer/attribute-templates';
import RetailerAttributeTemplateEditor from './retailer/attribute-template-editor';
import RetailerAiCatalog from './retailer/ai-catalog';
import RetailerAiCatalogNew from './retailer/ai-catalog-new';
import RetailerAiCatalogReview from './retailer/ai-catalog-review';
import RetailerReturns from './retailer/returns';
import RetailerPricing from './retailer/pricing';
import AdminDeliveryWindows from './admin/delivery-windows';
import AdminFees from './admin/fees';
import AdminTargetedDrops from './admin/targeted-drops';
import AdminAnomalyDetail from './admin/anomaly-detail';
import AdminWalletPayouts from './admin/wallet-payouts';
import AdminPaymentReconciliation from './admin/payment-reconciliation';
import AdminPaymentFailures from './admin/payment-failures';
import RetailerFees from './retailer/fees';
import RetailerVoucherBatch from './retailer/voucher-batch';
// §16-§22 (May 2026 frontend realignment)
import AdminRefundReconciliation from './admin/refund-reconciliation';
import AdminPostPayoutRecovery from './admin/post-payout-recovery';
import RetailerTaxInvoices from './retailer/tax-invoices';
import RetailerTaxInvoiceDetail from './retailer/tax-invoice-detail';
import AdminInvoiceNumbering from './admin/invoice-numbering';
import AdminGstReturns from './admin/gst-returns';
import RetailerCommissionInvoices from './retailer/commission-invoices';
import RetailerBillingStatements from './retailer/billing-statements';
import RetailerBillingStatementDetail from './retailer/billing-statement-detail';
import RetailerPayouts from './retailer/payouts';
import RetailerPayoutDetail from './retailer/payout-detail';
import RetailerEarlyDisbursement from './retailer/early-disbursement';
import AdminBillingConsole from './admin/billing-console';
import AdminPayoutsPipeline from './admin/payouts-pipeline';
import AdminPayoutDetail from './admin/payout-detail';
import AdminEarlyDisbursementDecisions from './admin/early-disbursement-decisions';
import AdminTailOfCycle from './admin/tail-of-cycle';
import AdminIssueDetail from './admin/issue-detail';
import RetailerIssueDetail from './retailer/issue-detail';
import AdminCommunityModeration from './admin/community-moderation';
import AdminReviewsModeration from './admin/reviews-moderation';
import AdminInbox from './admin/inbox';
import RetailerReportSales from './retailer/report-sales';
import RetailerReportPerformance from './retailer/report-performance';
import RetailerReportReturns from './retailer/report-returns';
import RetailerReportInventory from './retailer/report-inventory';
import AdminReportLeaderboard from './admin/report-leaderboard';
import AdminReportFunnel from './admin/report-funnel';
import AdminReportFeatureUsage from './admin/report-feature-usage';
import AdminReportOperational from './admin/report-operational';
import AdminReportCompliance from './admin/report-compliance';

export const router = createBrowserRouter([
  { path: '/', element: <Landing /> },

  // Admin
  { path: '/admin/login', element: <AdminLogin /> },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: <AdminDashboard /> },
      { path: 'retailers', element: <AdminRetailers /> },
      { path: 'retailers/:id', element: <AdminRetailerDetail /> },
      { path: 'applications', element: <AdminApplications /> },
      { path: 'applications/:id', element: <AdminApplicationsDetail /> },
      { path: 'collections', element: <AdminCollections /> },
      { path: 'collections/:id', element: <AdminCollectionDetail /> },
      // Catalog infra — listings depend on these as load-bearing data,
      // hidden from sidebar (super-admin reaches them via direct link).
      { path: 'catalog/categories', element: <AdminCategories /> },
      { path: 'catalog/brands', element: <AdminBrands /> },
      { path: 'promotions', element: <AdminPromotions /> },
      { path: 'promotions/new', element: <AdminPromotionNew /> },
      { path: 'promotions/:id', element: <AdminPromotionDetail /> },
      { path: 'clubbing', element: <AdminClubbing /> },
      { path: 'loyalty', element: <AdminLoyalty /> },
      { path: 'consumers', element: <AdminConsumers /> },
      { path: 'consumers/:id', element: <AdminConsumerDetail /> },
      { path: 'promotion-preview', element: <AdminPromotionPreview /> },
      { path: 'orders', element: <AdminOrdersList /> },
      { path: 'orders/new', element: <AdminPlaceTestOrder /> },
      { path: 'orders/:id', element: <AdminOrderDetail /> },
      { path: 'refunds', element: <AdminRefunds /> },
      { path: 'held-items', element: <AdminHeldItems /> },
      { path: 'issues', element: <AdminIssues /> },
      { path: 'admins', element: <AdminAdmins /> },
      { path: 'sub-roles', element: <AdminSubRoles /> },
      { path: 'compliance', element: <AdminCompliance /> },
      { path: 'compliance/:id', element: <AdminComplianceDetail /> },
      { path: 'policy-enforcement', element: <AdminPolicyEnforcement /> },
      { path: 'data-exports', element: <AdminDataExports /> },
      { path: 'account-deletions', element: <AdminAccountDeletions /> },
      { path: 'catalog-moderation', element: <AdminCatalogModeration /> },
      { path: 'listings/:id', element: <AdminListingDetail /> },
      { path: 'delivery-windows', element: <AdminDeliveryWindows /> },
      { path: 'fees', element: <AdminFees /> },
      { path: 'targeted-drops', element: <AdminTargetedDrops /> },
      { path: 'promotions/anomalies/:id', element: <AdminAnomalyDetail /> },
      { path: 'wallet-payouts', element: <AdminWalletPayouts /> },
      { path: 'payment-reconciliation', element: <AdminPaymentReconciliation /> },
      { path: 'payment-failures', element: <AdminPaymentFailures /> },
      // §16 Refunds
      { path: 'refund-reconciliation', element: <AdminRefundReconciliation /> },
      { path: 'post-payout-recovery', element: <AdminPostPayoutRecovery /> },
      // §17 Invoicing
      { path: 'invoice-numbering', element: <AdminInvoiceNumbering /> },
      { path: 'gst-returns', element: <AdminGstReturns /> },
      // §18 Settlement
      { path: 'billing-console', element: <AdminBillingConsole /> },
      { path: 'payouts-pipeline', element: <AdminPayoutsPipeline /> },
      { path: 'payouts/:id', element: <AdminPayoutDetail /> },
      { path: 'early-disbursement-decisions', element: <AdminEarlyDisbursementDecisions /> },
      { path: 'tail-of-cycle', element: <AdminTailOfCycle /> },
      // §19 Issues
      { path: 'issues/:id', element: <AdminIssueDetail /> },
      // §20 Customer
      { path: 'community-moderation', element: <AdminCommunityModeration /> },
      { path: 'reviews-moderation', element: <AdminReviewsModeration /> },
      // §21 Reports
      { path: 'reports/leaderboard', element: <AdminReportLeaderboard /> },
      { path: 'reports/funnel', element: <AdminReportFunnel /> },
      { path: 'reports/feature-usage', element: <AdminReportFeatureUsage /> },
      { path: 'reports/operational', element: <AdminReportOperational /> },
      { path: 'reports/compliance', element: <AdminReportCompliance /> },
      // §22 Notifications
      { path: 'inbox', element: <AdminInbox /> },
    ],
  },

  // Retailer
  // /retailer/signup retained as alias for backward-compat; both render the
  // doc-aligned Application form (signup.tsx removed during §2 cleanup).
  { path: '/retailer/signup', element: <RetailerApplication /> },
  { path: '/retailer/application', element: <RetailerApplication /> },
  { path: '/retailer/application-status', element: <RetailerApplicationStatus /> },
  { path: '/retailer/login', element: <RetailerLogin /> },
  {
    path: '/retailer',
    element: <RetailerLayout />,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: <RetailerDashboard /> },
      { path: 'store', element: <RetailerStorePage /> },
      { path: 'listings', element: <RetailerListings /> },
      { path: 'listings/:id', element: <RetailerListingDetail /> },
      { path: 'inventory', element: <RetailerInventory /> },
      { path: 'brands', element: <RetailerBrands /> },
      { path: 'promotions', element: <RetailerPromotions /> },
      { path: 'promotions/new', element: <RetailerPromotionNew /> },
      { path: 'promotions/:id', element: <RetailerPromotionDetail /> },
      { path: 'orders', element: <RetailerOrdersList /> },
      { path: 'orders/:id', element: <RetailerOrderDetail /> },
      { path: 'held-items', element: <RetailerHeldItems /> },
      { path: 'issues', element: <RetailerIssues /> },
      { path: 'staff', element: <RetailerStaff /> },
      { path: 'staff/:id', element: <RetailerStaffDetail /> },
      { path: 'kyc', element: <RetailerKyc /> },
      { path: 'change-requests', element: <RetailerChangeRequests /> },
      { path: 'holiday-calendar', element: <RetailerHolidayCalendar /> },
      { path: 'notification-prefs', element: <RetailerNotificationPrefs /> },
      { path: 'inbox', element: <RetailerInbox /> },
      { path: 'attribute-templates', element: <RetailerAttributeTemplates /> },
      { path: 'attribute-templates/:id', element: <RetailerAttributeTemplateEditor /> },
      { path: 'ai-catalog', element: <RetailerAiCatalog /> },
      { path: 'ai-catalog/new', element: <RetailerAiCatalogNew /> },
      { path: 'ai-catalog/:id', element: <RetailerAiCatalogReview /> },
      { path: 'returns', element: <RetailerReturns /> },
      { path: 'pricing', element: <RetailerPricing /> },
      { path: 'fees', element: <RetailerFees /> },
      { path: 'voucher-batch', element: <RetailerVoucherBatch /> },
      // §17 Invoicing
      { path: 'tax-invoices', element: <RetailerTaxInvoices /> },
      { path: 'tax-invoices/:id', element: <RetailerTaxInvoiceDetail /> },
      // §18 Settlement
      { path: 'commission-invoices', element: <RetailerCommissionInvoices /> },
      { path: 'billing-statements', element: <RetailerBillingStatements /> },
      { path: 'billing-statements/:id', element: <RetailerBillingStatementDetail /> },
      { path: 'payouts', element: <RetailerPayouts /> },
      { path: 'payouts/:id', element: <RetailerPayoutDetail /> },
      { path: 'early-disbursement', element: <RetailerEarlyDisbursement /> },
      // §19 Issues
      { path: 'issues/:id', element: <RetailerIssueDetail /> },
      // §21 Reports
      { path: 'reports/sales', element: <RetailerReportSales /> },
      { path: 'reports/performance', element: <RetailerReportPerformance /> },
      { path: 'reports/returns', element: <RetailerReportReturns /> },
      { path: 'reports/inventory-health', element: <RetailerReportInventory /> },
    ],
  },

  { path: '*', element: <Navigate to="/" replace /> },
]);
