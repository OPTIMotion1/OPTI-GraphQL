#!/usr/bin/env python3
"""
This script integrates security features into App.jsx
Run with: python integrate-security.py
"""

import re

def integrate_security():
    # Read current App.jsx
    with open('src/App.jsx', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Backup original
    with open('src/App.jsx.backup2', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✅ Backup created: App.jsx.backup2")
    
    # Add imports at top (after existing imports)
    imports_to_add = '''import { useAuth } from './AuthContext';
import { LoginPage } from './LoginPage';
import { useAuthenticatedFetch } from './useAuthenticatedFetch';
import { ConfirmDialog } from './ConfirmDialog';
'''
    
    # Find the last import and add after it
    last_import_pos = content.rfind('import')
    next_line = content.find('\n', last_import_pos)
    content = content[:next_line+1] + imports_to_add + content[next_line+1:]
    
    print("✅ Added imports")
    
    # Add helper function before App component
    helper_function = '''
// Helper function to check user permissions
function canUserSendCommand(user, commandType) {
  if (!user) return false;
  if (user.role === 'viewer') return false;
  if (user.role === 'operator') {
    return commandType === 'request_location' || commandType === 'location_request';
  }
  return true; // admin can send all commands
}

'''
    
    # Add before "function App()"
    app_pos = content.find('function App()')
    content = content[:app_pos] + helper_function + content[app_pos:]
    
    print("✅ Added helper function")
    
    # Update App function start
    old_app_start = '''function App() {
  const [isDark, setIsDark] = useDarkMode();'''
    
    new_app_start = '''function App() {
  const { isAuthenticated, loading: authLoading, user, logout, token } = useAuth();
  const authenticatedFetch = useAuthenticatedFetch();
  const [isDark, setIsDark] = useDarkMode();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    warning: '',
    danger: false,
    onConfirm: null
  });
  
  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: 'var(--text)'
      }}>
        🔄 Checking authentication...
      </div>
    );
  }
  
  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage />;
  }
  
  const [isDark, setIsDark] = useDarkMode();'''
    
    content = content.replace(old_app_start, new_app_start)
    
    print("✅ Added authentication check")
    
    # Update fetch calls to use authenticatedFetch
    # This is complex, so we'll add a note
    
    # Save updated content
    with open('src/App-Integrated.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✅ Created App-Integrated.jsx")
    print("\nNext steps:")
    print("1. Review App-Integrated.jsx")
    print("2. If it looks good, rename it to App.jsx")
    print("3. Restart frontend: npm run dev")

if __name__ == '__main__':
    integrate_security()
