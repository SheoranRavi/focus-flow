import React from 'react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-slate-200 mt-16">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Brand Section */}
          <div className="space-y-3">
            <h3 className="font-bold text-lg text-slate-800">Focus Flow</h3>
            <p className="text-sm text-slate-600">
              Stay focused, track your progress, and achieve your goals with our productivity timer.
            </p>
          </div>

          {/* Links Section */}
          <div className="space-y-3">
            <h4 className="font-semibold text-slate-800">Legal</h4>
            <ul className="space-y-2">
              <li>
                <a 
                  href="https://merchant.razorpay.com/policy/RxL6gyEm0EewW8/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-600 hover:text-emerald-600 transition-colors"
                >
                  Terms & Conditions
                </a>
              </li>
              <li>
                <a 
                  href="https://merchant.razorpay.com/policy/RxL6gyEm0EewW8/refund"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-600 hover:text-emerald-600 transition-colors"
                >
                  Cancellation & Refund Policy
                </a>
              </li>
              <li>
                <a 
                  href="https://merchant.razorpay.com/policy/RxL6gyEm0EewW8/shipping"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-600 hover:text-emerald-600 transition-colors"
                >
                  Shipping & Delivery Policy
                </a>
              </li>
            </ul>
          </div>

          {/* Contact/Social Section */}
          {/* <div className="space-y-3">
            <h4 className="font-semibold text-slate-800">Connect</h4>
            <p className="text-sm text-slate-600">
              Have questions or feedback? We'd love to hear from you.
            </p>
          </div> */}
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-500">
            © {currentYear} Focus Flow. All rights reserved.
          </p>
          {/* <p className="text-sm text-slate-500 flex items-center gap-1">
            Made with <Heart size={14} className="text-red-500 fill-red-500" /> for productivity
          </p> */}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
