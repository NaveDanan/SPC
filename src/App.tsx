import React from 'react';
import { AppContextProvider } from './context/AppContext';
import Header from './components/layout/Header';
import Dashboard from './components/layout/Dashboard';
import Footer from './components/layout/Footer';

function App() {
  return (
    <AppContextProvider>
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Header />
        <main className="flex-grow">
          <Dashboard />
        </main>
        <Footer />
      </div>
    </AppContextProvider>
  );
}

export default App;