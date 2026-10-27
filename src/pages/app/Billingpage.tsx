import React from 'react';

export default function BillingPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Billing & Subscription</h1>
      <p className="text-gray-600 mb-6">Manage your subscription plan and billing history.</p>
      
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <h2 className="text-lg font-semibold mb-2">Current Plan</h2>
        <p className="text-sm text-gray-500 mb-4">You are currently on the free trial/tier.</p>
        <button className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition">
          Upgrade Plan
        </button>
      </div>
    </div>
  );
}