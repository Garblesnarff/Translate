import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-background"
         style={{
           backgroundImage: `url(https://images.unsplash.com/photo-1465659132815-7563004c5439)`,
           backgroundSize: 'cover',
           backgroundPosition: 'center',
         }}>
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto bg-white/90 p-8 rounded-lg backdrop-blur">
          <h1 className="text-4xl font-bold text-primary mb-6">
            Tibetan Text Translation
          </h1>
          
          <p className="text-lg mb-8">
            Upload and translate Tibetan documents with advanced AI assistance
            and custom dictionary integration.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Features</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-2">
                  <li>PDF Document Upload</li>
                  <li>Google Gemini AI Translation</li>
                  <li>Custom Dictionary Integration</li>
                  <li>Side-by-side Translation View</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Get Started</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4">
                  Begin by uploading your Tibetan document and let our AI assist
                  with accurate translations.
                </p>
                <div className="space-y-2">
                  <Link href="/translate">
                    <Button className="w-full">Start Translating</Button>
                  </Link>
                  <Link href="/dashboard">
                    <Button variant="outline" className="w-full">View API Dashboard</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
