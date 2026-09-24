Design a clean, modern and simple web-based Employee Attendance Management Portal for a small company.

The system should be easy to understand and not overly complicated. It will eventually be developed using simple and commonly used technologies such as React for the frontend, Node.js/Express for the backend, and PostgreSQL for the database. The Figma design should therefore focus on practical web application screens rather than complex animations or unnecessary features.

The system has TWO user roles:

1. EMPLOYEE / USER
2. ADMIN

Create a professional desktop-first portal with a responsive layout. Use a clean corporate design, simple navigation, readable typography, clear buttons, cards, tables and forms.

========================================
AUTHENTICATION
==============

Create:

1. Login Page

* Company logo placeholder
* Email / Employee ID field
* Password field
* Login button
* "Forgot Password?" link
* "Don't have an account? Sign Up" option

2. Sign Up Page

* Full Name
* Employee ID
* Email
* Password
* Confirm Password
* Department
* Sign Up button
* Link back to Login

The system should determine the user's role after login and take them to either the Employee Portal or Admin Portal.

========================================
EMPLOYEE PORTAL
===============

Create a simple sidebar navigation:

* Dashboard
* Attendance
* Field Work
* Leaves
* Monthly Report
* Profile
* Logout

EMPLOYEE DASHBOARD

The dashboard should provide a quick overview of the employee's current attendance.

Include:

* Welcome message with employee name
* Current date
* Current clock-in time
* Current clock-out time
* Today's attendance status
* Large "Clock In" button
* Large "Clock Out" button

Attendance summary cards:

* Hours Worked This Month
* Total Leaves This Month
* Approved Leaves
* Remaining Leaves

Also show:

* Current month's attendance summary
* Recent attendance records
* Recent leave requests

The dashboard should clearly distinguish between office attendance and field work.

========================================
ATTENDANCE PAGE
===============

Create an attendance page containing:

Today's Attendance Card:

* Date
* Clock In
* Clock Out
* Total Office Hours
* Attendance Status

Clock In and Clock Out should be simple actions.

Below this, show an attendance history table:

Columns:

* Date
* Clock In
* Clock Out
* Total Hours
* Status

Include:

* Month selector
* Simple date filtering
* Monthly total hours

The system should calculate office working hours from Clock In and Clock Out.

Do not include field work hours in the clock-in/clock-out calculation.

========================================
FIELD WORK PAGE
===============

Create a separate Field Work section because some employees work outside the office.

The employee should be able to add field work hours separately from normal office attendance.

Include an "Add Field Work" button.

Field Work Form:

* Date
* Start Time
* End Time
* Total Hours (automatically calculated)
* Location / Site
* Purpose / Description
* Submit button

Below the form, display a Field Work History table:

* Date
* Location / Site
* Start Time
* End Time
* Total Field Hours
* Description
* Status

Field work should be treated separately from office Clock In / Clock Out.

The monthly report should show:

Office Hours
+
Approved Field Work Hours
=========================

Total Worked Hours

Do not automatically combine field work with clock-in/clock-out records.

========================================
LEAVES PAGE
===========

Create a Leave Management page.

At the top show summary cards:

* Total Leave Allowance
* Leaves Used
* Remaining Leaves
* Pending Requests

Add a prominent "Request Leave" button.

Leave Request Form:

* Leave Type
* Start Date
* End Date
* Number of Days
* Reason
* Submit Request

Leave history table:

* Request Date
* Leave Type
* Start Date
* End Date
* Days
* Reason
* Status

Use clear status indicators:

* Pending
* Approved
* Rejected

The employee can submit a request, but only the Admin can approve or reject it.

========================================
MONTHLY REPORT PAGE
===================

Create a simple Monthly Report page.

Include a month selector.

Show summary cards:

* Working Days
* Days Present
* Days Absent
* Total Office Hours
* Total Field Work Hours
* Total Worked Hours
* Leaves Taken
* Late Days

Create a monthly attendance table with:

* Date
* Attendance Status
* Clock In
* Clock Out
* Office Hours
* Field Work Hours
* Total Hours

Add:

* "Generate Monthly Report" button
* "Download Report" button

The report should be designed so it can later be generated as a PDF or Excel/CSV file by the actual application.

========================================
PROFILE PAGE
============

Include:

* Employee Name
* Employee ID
* Email
* Department
* Role
* Account Status

Allow the employee to update basic profile information and password.

========================================
ADMIN PORTAL
============

Create a separate Admin Dashboard using the same overall design language.

Admin sidebar:

* Dashboard
* Employees
* Attendance
* Field Work
* Leaves
* Reports
* Settings
* Logout

========================================
ADMIN DASHBOARD
===============

Create dashboard summary cards:

* Total Employees
* Present Today
* Absent Today
* On Leave
* Field Workers Today
* Total Hours This Month

Include a "Today's Attendance" table:

* Employee
* Department
* Clock In
* Clock Out
* Office Hours
* Field Hours
* Status

Include a section for:

"Pending Leave Requests"

with:

* Employee
* Leave Type
* Dates
* Days
* Status
* Approve button
* Reject button

========================================
ADMIN EMPLOYEES PAGE
====================

Create an employee management table:

* Employee ID
* Name
* Email
* Department
* Role
* Status
* Actions

Actions:

* View
* Edit
* Activate / Deactivate

Add:

"Add Employee" button.

Employee details should include attendance and leave information.

========================================
ADMIN ATTENDANCE PAGE
=====================

Create an attendance management page where the Admin can view attendance for all employees.

Include filters:

* Employee
* Department
* Month
* Date
* Status

Attendance table:

* Employee
* Date
* Clock In
* Clock Out
* Office Hours
* Field Hours
* Total Hours
* Status

Allow Admin to view and, when necessary, correct attendance records.

Any manual attendance correction should later be recorded in the system for accountability.

========================================
ADMIN FIELD WORK PAGE
=====================

Create a page where Admin can view submitted field work.

Table:

* Employee
* Date
* Location
* Start Time
* End Time
* Hours
* Description
* Status

Admin should be able to:

* View
* Approve
* Reject

field work submissions.

Only approved field work should be included in the employee's monthly total worked hours.

========================================
ADMIN LEAVES PAGE
=================

Create a Leave Management page.

Show:

* Pending Requests
* Approved Requests
* Rejected Requests

Table:

* Employee
* Leave Type
* Start Date
* End Date
* Days
* Reason
* Request Date
* Status
* Actions

Actions:

* Approve
* Reject
* View Details

========================================
ADMIN REPORTS PAGE
==================

Create a simple reporting dashboard.

Allow Admin to select:

* Month
* Employee
* Department

Generate:

* Attendance Report
* Leave Report
* Field Work Report
* Monthly Working Hours Report

Include buttons:

* Generate Report
* Export CSV
* Export Excel
* Print / PDF

Keep reporting simple and practical.

========================================
GENERAL DESIGN REQUIREMENTS
===========================

Use a professional corporate dashboard style.

Design principles:

* Simple
* Clean
* Easy to navigate
* Minimal unnecessary elements
* Desktop-first
* Responsive
* Clear visual hierarchy
* Consistent buttons
* Consistent forms
* Consistent tables
* Clear status indicators
* Accessible typography
* Plenty of whitespace

Use a left sidebar for portal navigation and a top bar containing:

* Page title
* Notifications
* User name
* Profile menu

Use cards for important statistics.

Use tables for attendance, field work and leave history.

Use modal dialogs for simple actions such as:

* Approve Leave
* Reject Leave
* Edit Attendance
* Add Employee

Create reusable UI components for:

* Buttons
* Input fields
* Dropdowns
* Cards
* Tables
* Status badges
* Modals
* Navigation
* Date/month selectors

========================================
IMPORTANT SYSTEM LOGIC TO REFLECT IN THE DESIGN
===============================================

Keep these concepts clearly separated:

1. OFFICE ATTENDANCE
   Clock In → Clock Out → Office Hours

2. FIELD WORK
   Employee separately submits Field Work → Admin reviews → Approved Field Work Hours

3. LEAVES
   Employee submits Leave Request → Admin Approves/Rejects

4. MONTHLY REPORT
   Office Hours + Approved Field Work Hours = Total Worked Hours

The system should NOT treat field work as Clock In / Clock Out.

The employee should be able to easily understand how many hours they worked in the office, how many approved field-work hours they completed, and their total worked hours for the month.

Do not add payroll, salary management, biometric attendance, facial recognition, GPS tracking, complex HR management, or other advanced features.

The goal is a small, practical and maintainable company attendance portal.
