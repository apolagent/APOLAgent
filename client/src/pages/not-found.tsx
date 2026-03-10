import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 text-white">
      <div className="text-center px-4">
        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-6" />
        <h1 className="font-meme text-4xl md:text-6xl gradient-text mb-4" data-testid="text-404">
          404
        </h1>
        <p className="text-xl text-gray-400 mb-8">
          This page got rug pulled! Nothing to see here.
        </p>
        <Link href="/">
          <Button className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-8 py-3 rounded-xl" data-testid="button-go-home">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Safety
          </Button>
        </Link>
      </div>
    </div>
  );
}
