import axios from "axios";
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081/api/v1";
export const API_URL = rawApiUrl.replace(/\/+$/, "");

// Python FastAPI cart service (Cloud Run)
const rawCartUrl = process.env.NEXT_PUBLIC_CART_API_URL || "http://localhost:8000";
export const CART_API_URL = rawCartUrl.replace(/\/+$/, "");

import { CustomersType } from "./types/CustomersType";

export const getProducts = async () => {
  const res = await axios.get(`${API_URL}/products`);
  return res.data;
};

export const getCustomers = async () => {
  const res = await axios.get(`${API_URL}/customers`);
  return res.data;
};

export const addCustomer = async (customer: CustomersType) => {
  const res = await axios.post(`${API_URL}/customers`, customer);
  return res.data;
};

export const getOrders = async () => {
  const res = await axios.get(`${API_URL}/orders`);
  return res.data;
};
export const addOrder = async (order: object) => {
  const res = await axios.post(`${API_URL}/orders`, order);
  return res.data;
};

// ─── Cart / Session API (Python Cloud Run) ───────────────────────────────────

export interface CartItem {
  productId: string;
  productName: string;
  unitCost: number;
  quantity: number;
  lineTotalKes: number;
}

export interface CartResponse {
  success: boolean;
  cart: { items: CartItem[]; subtotalKes: number };
}

export const createSession = async (payload: {
  sessionId: string;
  name: string;
  phone: string;
  location: string;
}) => {
  const res = await axios.post(`${CART_API_URL}/session`, payload);
  return res.data;
};

export const getCartFromApi = async (sessionId: string): Promise<CartResponse> => {
  const res = await axios.get(`${CART_API_URL}/cart/${sessionId}`);
  return res.data;
};

export const addToCartApi = async (payload: {
  sessionId: string;
  productId: string;
  productName: string;
  unitCost: number;
  quantity: number;
}) => {
  const res = await axios.post(`${CART_API_URL}/addToCart`, payload);
  return res.data;
};

export const modifyCartApi = async (payload: {
  sessionId: string;
  productId: string;
  quantity: number;
}) => {
  const res = await axios.post(`${CART_API_URL}/modifyCart`, payload);
  return res.data;
};

export const removeCartItemApi = async (sessionId: string, productId: string) => {
  const res = await axios.delete(`${CART_API_URL}/cart/${sessionId}/item/${productId}`);
  return res.data;
};
