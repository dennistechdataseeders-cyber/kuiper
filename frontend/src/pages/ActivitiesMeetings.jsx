// frontend/src/pages/ActivitiesMeetings.jsx
// Meetings: Zoho-style table + Month/Week calendar (see components/ActivityListView.jsx).
// Clicking a meeting opens its detail page (/sales/activity/:id).
import React from 'react';
import ActivityListView from '../components/ActivityListView';

export default function ActivitiesMeetings() {
  return <ActivityListView type="meeting" />;
}
