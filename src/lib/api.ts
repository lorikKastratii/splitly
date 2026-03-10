import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://splitly-production-72fd.up.railway.app/api';

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  requiresAuth?: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async getAuthToken(): Promise<string | null> {
    return await AsyncStorage.getItem('auth_token');
  }

  private async request(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<any> {
    const { method = 'GET', body, requiresAuth = true } = options;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (requiresAuth) {
      const token = await this.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const config: RequestInit = {
      method,
      headers,
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, config);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || 'Request failed');
    }

    return await response.json();
  }

  async register(email: string, password: string, name: string) {
    const response = await this.request('/auth/register', {
      method: 'POST',
      body: { email, password, name },
      requiresAuth: false,
    });

    if (response.token) {
      await AsyncStorage.setItem('auth_token', response.token);
    }

    return response;
  }

  async login(email: string, password: string) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: { email, password },
      requiresAuth: false,
    });

    if (response.token) {
      await AsyncStorage.setItem('auth_token', response.token);
    }

    return response;
  }

  async logout() {
    await AsyncStorage.removeItem('auth_token');
  }

  async getProfile() {
    return await this.request('/auth/profile');
  }

  async updateProfile(data: { name?: string; avatar_url?: string }) {
    return await this.request('/auth/profile', {
      method: 'PUT',
      body: data,
    });
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return await this.request('/auth/change-password', {
      method: 'PUT',
      body: { current_password: currentPassword, new_password: newPassword },
    });
  }

  async getGroups() {
    return await this.request('/groups');
  }

  async getGroup(groupId: string) {
    return await this.request(`/groups/${groupId}`);
  }

  async createGroup(data: {
    name: string;
    description?: string;
    currency: string;
    image_url?: string;
  }) {
    return await this.request('/groups', {
      method: 'POST',
      body: data,
    });
  }

  async updateGroup(
    groupId: string,
    data: {
      name?: string;
      description?: string;
      currency?: string;
      image_url?: string;
    }
  ) {
    return await this.request(`/groups/${groupId}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteGroup(groupId: string) {
    return await this.request(`/groups/${groupId}`, {
      method: 'DELETE',
    });
  }

  async joinGroup(inviteCode: string) {
    return await this.request('/groups/join', {
      method: 'POST',
      body: { invite_code: inviteCode },
    });
  }

  async addMemberToGroup(groupId: string, userId: string) {
    return await this.request(`/groups/${groupId}/members`, {
      method: 'POST',
      body: { user_id: userId },
    });
  }

  async leaveGroup(groupId: string) {
    return await this.request(`/groups/${groupId}/leave`, {
      method: 'DELETE',
    });
  }

  async getGroupExpenses(groupId: string) {
    return await this.request(`/expenses/group/${groupId}`);
  }

  async createExpense(data: {
    group_id: string;
    description: string;
    amount: number;
    currency: string;
    paid_by?: string;
    split_type: string;
    category?: string;
    date?: string;
    notes?: string;
    splits: Array<{
      user_id: string;
      amount: number;
      percentage?: number;
    }>;
  }) {
    return await this.request('/expenses', {
      method: 'POST',
      body: data,
    });
  }

  async deleteExpense(expenseId: string) {
    return await this.request(`/expenses/${expenseId}`, {
      method: 'DELETE',
    });
  }

  async getGroupSettlements(groupId: string) {
    return await this.request(`/settlements/group/${groupId}`);
  }

  async createSettlement(data: {
    group_id: string;
    from_user?: string;
    to_user: string;
    amount: number;
    currency: string;
    date?: string;
    notes?: string;
  }) {
    return await this.request('/settlements', {
      method: 'POST',
      body: data,
    });
  }

  async deleteSettlement(settlementId: string) {
    return await this.request(`/settlements/${settlementId}`, {
      method: 'DELETE',
    });
  }

  async getFriends() {
    return await this.request('/friends');
  }

  async addFriend(data: {
    name: string;
    email?: string;
    phone?: string;
    avatar_url?: string;
  }) {
    return await this.request('/friends', {
      method: 'POST',
      body: data,
    });
  }

  async updateFriend(
    friendId: string,
    data: {
      name?: string;
      email?: string;
      phone?: string;
      avatar_url?: string;
    }
  ) {
    return await this.request(`/friends/${friendId}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteFriend(friendId: string) {
    return await this.request(`/friends/${friendId}`, {
      method: 'DELETE',
    });
  }

  // Friend Requests
  async searchUsers(query: string) {
    return await this.request(`/friend-requests/search?query=${encodeURIComponent(query)}`);
  }

  async sendFriendRequest(toUserId: string) {
    return await this.request('/friend-requests', {
      method: 'POST',
      body: { to_user_id: toUserId },
    });
  }

  async getFriendRequests() {
    return await this.request('/friend-requests');
  }

  async acceptFriendRequest(requestId: string) {
    return await this.request(`/friend-requests/${requestId}/accept`, {
      method: 'PUT',
    });
  }

  async rejectFriendRequest(requestId: string) {
    return await this.request(`/friend-requests/${requestId}/reject`, {
      method: 'PUT',
    });
  }

  async getPaymentConfig(): Promise<{ paymentRequired: boolean }> {
    return await this.request('/payments/config', { requiresAuth: false });
  }

  async getPlans(): Promise<{ plans: Array<{
    id: string;
    name: string;
    description: string;
    priceInCents: number;
    currency: string;
    billingPeriod: string;
    sortOrder: number;
  }> }> {
    return await this.request('/payments/plans', { requiresAuth: false });
  }

  async createPaymentIntent(planId: string): Promise<{ clientSecret: string; paymentIntentId: string }> {
    return await this.request('/payments/create-intent', {
      method: 'POST',
      body: { planId },
    });
  }

  async getEntitlement(): Promise<{
    synced: boolean;
    hasLifetimeAccess: boolean;
    tier: 'free' | 'lifetime';
  }> {
    return await this.request('/payments/entitlement');
  }

  async getFeatures(): Promise<{
    features: Array<{
      key: string;
      type: 'boolean' | 'numeric';
      booleanValue: boolean | null;
      numericValue: number | null;
    }>;
    isFreeTier: boolean;
    planName: string | null;
  }> {
    return await this.request('/payments/features');
  }

  async checkTrialEligibility(planId: string, deviceFingerprint?: string): Promise<{
    eligible: boolean;
    reason: string | null;
    trialDays: number;
    requiresCard: boolean;
    introPriceInCents: number | null;
    regularPriceInCents: number | null;
    currency: string | null;
  }> {
    return await this.request('/payments/trials/check-eligibility', {
      method: 'POST',
      body: { planId, ...(deviceFingerprint ? { deviceFingerprint } : {}) },
    });
  }

  async startTrial(planId: string, paymentMethodId?: string, deviceFingerprint?: string): Promise<{
    subscriptionId: string;
    stripeSubscriptionId: string;
    status: string;
    trialEnd: string;
    trialDays: number;
    planName: string;
    requiresCard: boolean;
  }> {
    return await this.request('/payments/trials/start', {
      method: 'POST',
      body: {
        planId,
        ...(paymentMethodId ? { paymentMethodId } : {}),
        ...(deviceFingerprint ? { deviceFingerprint } : {}),
      },
    });
  }

  async cancelTrial(subscriptionId: string): Promise<{
    subscriptionId: string;
    status: string;
    canceledAt: string;
  }> {
    return await this.request(`/payments/trials/${subscriptionId}/cancel`, {
      method: 'POST',
    });
  }

  async validateCoupon(code: string, planId: string): Promise<{
    valid: boolean;
    discountType: string | null;
    percentOff: number | null;
    amountOffCents: number | null;
    currency: string | null;
    duration: string | null;
    durationInMonths: number | null;
    couponName: string | null;
    originalPriceCents: number | null;
    discountedPriceCents: number | null;
    error: string | null;
  }> {
    return await this.request('/payments/coupons/validate', {
      method: 'POST',
      body: { code, planId },
    });
  }

  async createPaymentIntentWithCoupon(planId: string, promotionCode?: string): Promise<{
    clientSecret: string;
    paymentIntentId: string;
    originalAmountCents: number | null;
    discountAmountCents: number | null;
    finalAmountCents: number | null;
    promotionCode: string | null;
  }> {
    return await this.request('/payments/create-intent-with-coupon', {
      method: 'POST',
      body: { planId, ...(promotionCode ? { promotionCode } : {}) },
    });
  }

  getFullUrl(path: string): string {
    if (path.startsWith('http')) return path;
    return this.baseUrl.replace(/\/api$/, '') + path;
  }

  async uploadImage(imageUri: string) {
    const token = await this.getAuthToken();

    const formData = new FormData();
    formData.append('image', {
      uri: imageUri,
      type: 'image/jpeg',
      name: 'upload.jpg',
    } as any);

    const response = await fetch(`${this.baseUrl}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Upload failed');
    }

    return await response.json();
  }
}

export const api = new ApiClient(API_URL);
