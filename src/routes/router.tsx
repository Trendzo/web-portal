import { createBrowserRouter, Navigate } from 'react-router-dom';
import Landing from './landing';
import AdminLogin from './admin/login';
import AdminLayout from './admin/layout';
import AdminDashboard from './admin/dashboard';
import AdminRetailers from './admin/retailers';
import AdminStores from './admin/stores';
import AdminCollections from './admin/collections';
import AdminCollectionDetail from './admin/collection-detail';
import AdminCategories from './admin/categories';
import AdminBrands from './admin/brands';
import RetailerSignup from './retailer/signup';
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
import RetailerHeldItems from './retailer/held-items';

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
      { path: 'stores', element: <AdminStores /> },
      { path: 'collections', element: <AdminCollections /> },
      { path: 'collections/:id', element: <AdminCollectionDetail /> },
      { path: 'categories', element: <AdminCategories /> },
      { path: 'brands', element: <AdminBrands /> },
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
    ],
  },

  // Retailer
  { path: '/retailer/signup', element: <RetailerSignup /> },
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
    ],
  },

  { path: '*', element: <Navigate to="/" replace /> },
]);
