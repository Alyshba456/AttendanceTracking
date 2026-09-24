Modify the existing Attendance Management Portal design with the following authentication and employee-account workflow.

IMPORTANT: This is an internal company attendance portal. Employees must NOT create their own accounts.

REMOVE:

* Employee Sign Up page
* "Create Account" option on Login page
* Public registration
* Any self-registration functionality

========================================
LOGIN SYSTEM
============

Keep only a Login page.

Login page should contain:

* Company logo
* Email / Company Email field
* Password field
* Login button
* "Forgot Password?" option

Do NOT show:

* Sign Up
* Create Account
* Register

Employees receive their login credentials from the Admin.

========================================
EMPLOYEE CREATION BY ADMIN
==========================

The Admin is responsible for creating employee accounts.

On the Admin Portal → Employees page, provide an:

"Add Employee" button.

When clicked, open an Add Employee form containing:

* Full Name
* Employee ID
* Department
* Designation
* Company Email
* Temporary Password
* Confirm Temporary Password
* Account Status

The Admin can enter/provide the employee's company email and temporary password when creating the account.

The credentials entered by the Admin are the credentials that the employee will use to log into the Attendance Portal.

After creating the employee account, show a confirmation screen:

"Employee account created successfully."

Display:

* Employee Name
* Employee ID
* Company Email
* Temporary Password

Include an option:

"Copy Credentials"

The Admin can then securely provide these credentials to the employee.

========================================
FIRST LOGIN
===========

When an employee logs in for the FIRST TIME using the credentials provided by the Admin, do NOT take them directly to the Employee Dashboard.

Instead, take them to:

"Change Your Password"

Page.

Display a message:

"For security, please change your temporary password before continuing."

Fields:

* Current / Temporary Password
* New Password
* Confirm New Password

Button:

"Change Password"

The employee must successfully change the temporary password before accessing the Employee Dashboard.

========================================
AFTER PASSWORD CHANGE
=====================

After the password is successfully changed:

Redirect the employee to the Employee Dashboard.

The employee should then use their newly created password for all future logins.

The temporary password should no longer be usable after the password is changed.

========================================
FORGOT PASSWORD
===============

Keep a simple "Forgot Password?" option on the Login page.

The design should provide a basic password-reset flow.

Do not make this overly complicated.

The Admin should also have the ability to reset an employee's password from:

Admin Portal → Employees → Employee Details.

Add an action:

"Reset Password"

If the Admin resets the password, generate/set a new temporary password and require the employee to change it after their next login.

========================================
ADMIN EMPLOYEE MANAGEMENT
=========================

Update the Admin Employees page.

Employee table should contain:

* Employee ID
* Name
* Company Email
* Department
* Designation
* Account Status
* Actions

Actions:

* View
* Edit
* Reset Password
* Activate / Deactivate

When viewing an employee's details, show:

Employee Information:

* Name
* Employee ID
* Email
* Department
* Designation
* Account Status

Attendance Summary:

* Current Month Hours
* Total Leaves
* Remaining Leaves
* Field Work Hours

========================================
ACCOUNT STATUS
==============

Use clear account statuses:

* Active
* Inactive

Only Active employees should be able to log into the portal.

If an employee is deactivated by Admin, prevent that account from logging in.

========================================
AUTHENTICATION FLOW
===================

Design the complete user flow as:

ADMIN:

Admin Login
↓
Admin Dashboard
↓
Employees
↓
Add Employee
↓
Enter Employee Information
↓
Set Company Email + Temporary Password
↓
Create Employee
↓
Account Created
↓
Provide Credentials to Employee

EMPLOYEE:

Open Attendance Portal
↓
Login using Company Email + Temporary Password
↓
First Login?
↓
YES
↓
Change Password
↓
Employee Dashboard
↓
Normal Portal Access

FUTURE LOGIN:

Open Attendance Portal
↓
Company Email + New Password
↓
Employee Dashboard

========================================
IMPORTANT
=========

There should be NO employee self-registration.

The Admin controls employee account creation.

The credentials created/provided by the Admin are the initial credentials used by the employee.

The employee must change the temporary password during their first login.

Keep this system simple and suitable for a small company.

Do not add social login, Google login, Microsoft login, biometric login, OTP systems, or other complicated authentication features at this stage.
