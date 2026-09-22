import { render } from '@testing-library/react';
import App from './App';
import { AuthProvider } from './context/AuthContext';

test('renders App without crashing', () => {
  render(
    <AuthProvider>
      <App />
    </AuthProvider>
  );
});
