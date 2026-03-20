import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-white border-t border-gray-200 py-2 fixed bottom-0 left-0 right-0 z-20 h-10 sm:h-12 shadow-sm">
      <div className="container mx-auto px-3 sm:px-4 h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-xs text-gray-600">
            Powered by{' '}
            <a
              href="https://www.botivate.in"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary-hover font-medium transition-all duration-200 hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded"
            >
              Botivate
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
