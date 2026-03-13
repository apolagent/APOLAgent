import { Shield } from "lucide-react";

export default function Footer() {
  return (
    <footer className="py-12 bg-gradient-to-r from-slate-900 to-black border-t border-blue-500/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="flex justify-center items-center space-x-4 mb-6">
            <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-slate-900" />
            </div>
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">🍌</span>
            </div>
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center overflow-hidden">
              <img
                src="/ape-police-logo.png"
                alt="APE POLICE logo"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <p className="text-lg mb-4 text-white">
            © 2025 <span className="font-meme gradient-text">APE POLICE</span>. Meme Enforcement Agency.
          </p>
          <p className="text-sm text-slate-300 max-w-2xl mx-auto leading-relaxed">
            No financial advice given — just viral justice and jungle protection. 
            Always DYOR and stay safe in the crypto jungle! 🌿🔐
          </p>
        </div>
      </div>
    </footer>
  );
}
