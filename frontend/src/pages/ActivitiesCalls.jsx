// frontend/src/pages/ActivitiesCalls.jsx
// Calls: Zoho-style table + Month/Week calendar (see components/ActivityListView.jsx).
// Clicking a call opens its detail page (/sales/activity/:id).
import React from 'react';
import ActivityListView from '../components/ActivityListView';

export default function ActivitiesCalls() {
  return <ActivityListView type="call" />;
}
