import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-800 text-gray-300 py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <h3 className="text-lg font-semibold">NJ-Labs SPC Analysis Tool</h3>
            <p className="text-sm">Statistical Process Control for quality improvement</p>
          </div>
          
          <div className="text-sm">
            <p>&copy; {new Date().getFullYear()} NJ-Labs, SPC Analysis. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;