# OPTI Fleet Dashboard with Auto-Cutoff

A comprehensive fleet management dashboard for Optimotion with automated vehicle immobilization for overdue rentals via VoltCred API and WhatsApp notifications via GetGabs.

![Status](https://img.shields.io/badge/status-active-success.svg)
![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)

## 🚀 Features

### Dashboard Management
- **Real-time Fleet Tracking**: Monitor all 257 vehicles with live status updates
- **Asset Management**: View vehicle details, locations, and operational status
- **Activity Logging**: Track all commands and system activities
- **Responsive UI**: Clean, modern interface with dark mode support

### Auto-Cutoff System
- ✅ **Automatic Overdue Detection**: Fetches 257+ rental records from Optimotion Dashboard API
- ✅ **Smart Filtering**: Filter by exact overdue days (e.g., -7 = exactly 7 days overdue)
- ✅ **Batch Operations**: Lock/unlock multiple vehicles with one click
- ✅ **WhatsApp Notifications**: Send bulk template messages to overdue riders via GetGabs
- ✅ **Individual Controls**: Lock, unlock, or hold individual vehicles
- ✅ **Pagination**: Clean table view with 10 riders per page

### Overdue Logic (Matching Optimotion Dashboard)
- **Negative values** = Overdue (e.g., -7 means 7 days overdue)
- **Positive values** = Days remaining (e.g., 5 means 5 days left)
- **Zero** = Due today
- **Filter = 0**: Shows ALL overdue riders
- **Filter = -7**: Shows ONLY riders with exactly -7 days overdue

### Statistics Dashboard
- Total Riders: 257
- Overdue Count: Real-time tracking
- Successful Cutoffs: Historical count
- Pending Operations: Live status

## 📋 Tech Stack

### Backend
- **Node.js** with Express.js
- **Axios** for API integrations
- **JWT** for authentication
- **Cookie-based** Optimotion API auth

### Frontend
- **React 18** with Vite
- **CSS3** with custom properties (dark mode)
- **Context API** for state management

### APIs Integrated
- **Optimotion Dashboard API**: Rental data fetching
- **VoltCred API**: Vehicle command and control
- **GetGabs API**: WhatsApp template notifications

## 🛠️ Installation

### Prerequisites
- Node.js v18+ and npm
- Git
- Optimotion Dashboard credentials
- VoltCred API credentials
- GetGabs API key (for notifications)

### Step 1: Clone Repository
```bash
git clone https://github.com/SrishtiKarn11/OPTI-GraphQL.git
cd OPTI-GraphQL
```

### Step 2: Backend Setup
```bash
cd backend
npm install
```

Create `.env` file in backend directory:
```env
PORT=5001

# VoltCred API
VOLTCRED_GRAPHQL_URL=https://api.voltcred.com/v2/graphql
VOLTCRED_EMAIL=your-email@example.com
VOLTCRED_PASSWORD=your-password

# Optimotion Dashboard API
RENEWALS_API_URL=https://api.optimotion.in/api/v1/finance/renewals/list
RENEWALS_LOGIN_URL=https://dashboard.optimotion.in/api/login
RENEWALS_API_USERNAME=your-phone-number
RENEWALS_API_PASSWORD=your-password
RENEWALS_API_COOKIE=your-session-cookie

# JWT Secret
JWT_SECRET=change-this-to-a-strong-random-secret

# GetGabs WhatsApp API
GETGABS_API_KEY=your-getgabs-api-key
GETGABS_SENDER=9121581421
GETGABS_CAMPAIGN_ID=your-campaign-id
GETGABS_TEMPLATE_NAME=overdue_rental_cutoff
GETGABS_TEMPLATE_LANGUAGE=en_US
```

Start backend:
```bash
npm start
# or for development
npm run dev
```

Backend runs on: http://localhost:5001

### Step 3: Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```

Frontend runs on: http://localhost:5173

## 📱 GetGabs WhatsApp Setup

### 1. GetGabs Account Configuration
1. Login to [GetGabs Dashboard](https://app.getgabs.com)
2. Get your API key from Settings
3. Verify sender WhatsApp number
4. Create and approve template

### 2. Template Configuration
Template Name: `overdue_rental_cutoff`

Template Content:
```
Immediate Action Required

🔴 {{1}}, your rental is now OVERDUE.

⚠️ If not resolved soon, your vehicle's engine will be REMOTELY SHUT DOWN 🚨 and immobilized according to our rental policy.

💡 End or extend your trip NOW to avoid this.

☎️ Contact support immediately if you're facing an issue.

Optimotion Fleet Security

[pay now]
```

Variables:
- `{{1}}`: Rider name

### 3. Testing Notifications
```bash
cd backend
node test-notification.js 919876543210
```

**Note:** If you get "Wrong parameters" error, contact GetGabs support to verify:
- API key has template send permissions
- Sender number is properly verified
- Template is linked to your account

## 🔐 Authentication

### Default Admin Credentials
- **Phone:** 8375066843
- **Password:** Optimotion!pass1

### Creating New Users
Users are managed in backend code. Add new users in authentication service.

## 📊 API Endpoints

### Auto-Cutoff Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auto-cutoff/all-rentals` | Get all 257 riders |
| GET | `/api/auto-cutoff/overdue?minOverdueDays=X` | Get filtered overdue riders |
| POST | `/api/auto-cutoff/notify` | Send WhatsApp notifications |
| POST | `/api/auto-cutoff/check-and-execute` | Execute auto-cutoff |
| GET | `/api/auto-cutoff/logs` | Get cutoff logs |
| GET | `/api/auto-cutoff/stats` | Get statistics |
| POST | `/api/auto-cutoff/reset/:rentalId` | Reset cutoff status |
| GET | `/api/auto-cutoff/health` | Health check |

### Vehicle Command Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/assets` | Get all vehicles |
| POST | `/api/command` | Send vehicle command |
| GET | `/api/activity` | Get activity logs |

## 🎯 Usage Guide

### For Admins

#### 1. View All Riders
- Login → Auto Cutoff tab
- Default view shows all 257 riders
- Use search to find specific riders

#### 2. Filter Overdue Riders
- Click filter dropdown → "Overdue Only"
- Shows 24 overdue riders (updates in real-time)
- Adjust "Exact Days" filter:
  - `0` = Show ALL overdue
  - `-7` = Show ONLY -7 days overdue
  - `-6` = Show ONLY -6 days overdue

#### 3. Send Notifications
**Option A: Selected Riders**
1. Select riders with checkboxes
2. Click "📱 Notify All (X)"
3. Confirm action

**Option B: All Filtered**
1. Set filter (e.g., "Overdue Only")
2. Click "📱 Notify All"
3. All filtered riders receive WhatsApp message

#### 4. Lock Vehicles
**Individual:**
- Click 🔒 button on rider row

**Bulk:**
- Set filter
- Click "🔒 Lock All"
- All filtered vehicles will be locked

#### 5. View Logs
- Scroll to "Recent Cutoff Logs" section
- See execution history, status, timestamps

## 🚢 Deployment

### Option 1: Render.com (Recommended)

#### Backend Deployment
1. Create new Web Service on Render
2. Connect GitHub repository
3. Configure:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `node src/app.js`
4. Add environment variables from `.env`

#### Frontend Deployment
1. Create new Static Site on Render
2. Configure:
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Publish Directory: `dist`
3. Add environment variable:
   ```
   VITE_API_URL=https://your-backend.onrender.com
   ```

### Option 2: VPS Deployment

```bash
# On your VPS
git clone https://github.com/SrishtiKarn11/OPTI-GraphQL.git
cd OPTI-GraphQL

# Backend
cd backend
npm install
pm2 start src/app.js --name opti-backend

# Frontend
cd ../frontend
npm install
npm run build
# Copy dist/ to nginx/apache public folder
```

## 🐛 Troubleshooting

### Backend Issues

**"Timeout of 10000ms exceeded"**
- ✅ Fixed: Timeout increased to 30 seconds
- Optimotion API can be slow with 257 records

**"0 showing in stats"**
- ✅ Fixed: Backend now returns correct counts

**"Phone numbers not showing"**
- ✅ Fixed: Extracting from `riderUID` field

### Frontend Issues

**"React Hooks order error"**
- ✅ Fixed: Hooks moved before conditional returns

**"Overdue count doesn't match dashboard"**
- ✅ Fixed: Inverted calculation (negative = overdue)

### GetGabs Notification Issues

**"Wrong parameters" error**
- Check API key is correct
- Verify sender number is verified
- Ensure template is approved
- Contact GetGabs support for account configuration

## 📁 Project Structure

```
OPTI-GraphQL/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── assets.routes.js
│   │   │   ├── command.routes.js
│   │   │   ├── activity.routes.js
│   │   │   └── auto-cutoff.routes.js
│   │   ├── services/
│   │   │   ├── graphql.service.js
│   │   │   ├── voltcred.service.js
│   │   │   ├── renewals.service.js
│   │   │   ├── auto-cutoff.service.js
│   │   │   ├── cutoff-tracker.service.js
│   │   │   ├── getgabs.service.js
│   │   │   └── activity-log.service.js
│   │   ├── middleware/
│   │   │   └── auth.middleware.js
│   │   └── app.js
│   ├── data/
│   │   └── cutoff-logs.json
│   ├── .env
│   ├── package.json
│   └── test-notification.js
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── AuthContext.jsx
│   │   ├── LoginPage.jsx
│   │   ├── ConfirmDialog.jsx
│   │   ├── useAuthenticatedFetch.js
│   │   ├── main.jsx
│   │   └── index.css
│   ├── public/
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── README.md
├── DEPLOYMENT-READY-STATUS.md
└── TEST-NOTIFICATION-GUIDE.md
```

## 🔧 Configuration Files

### backend/.env
All API credentials and configuration

### frontend/vite.config.js
Proxy configuration for development

## 📖 Additional Documentation

- [DEPLOYMENT-READY-STATUS.md](./DEPLOYMENT-READY-STATUS.md) - Detailed deployment checklist
- [TEST-NOTIFICATION-GUIDE.md](./TEST-NOTIFICATION-GUIDE.md) - WhatsApp notification testing guide

## 🤝 Contributing

This is a private project for Optimotion. Contributions are limited to authorized team members.

## 📝 License

Proprietary - All rights reserved by Optimotion

## 🆘 Support

For issues or questions:
1. Check documentation files
2. Review troubleshooting section
3. Contact GetGabs support for notification issues
4. Reach out to development team

## 🎉 Acknowledgments

- **Optimotion Team** for requirements and testing
- **VoltCred** for vehicle control API
- **GetGabs** for WhatsApp Business API integration

---

**Built with ❤️ for Optimotion Fleet Management**

Last Updated: July 29, 2026
