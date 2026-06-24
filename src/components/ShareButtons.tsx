"use client";

import { MessageCircle, Twitter, Linkedin, Mail, Link2 } from "lucide-react";

interface ShareButtonsProps {
  shareUrl: string;
  shareLinks: {
    whatsapp: string;
    twitter: string;
    linkedin: string;
    email: string;
  };
}

export default function ShareButtons({ shareUrl, shareLinks }: ShareButtonsProps) {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert("✅ Enlace copiado al portapapeles");
    });
  };

  return (
    <div className="flex flex-wrap gap-3">
      <a
        href={shareLinks.whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
      >
        <MessageCircle className="h-4 w-4" /> WhatsApp
      </a>
      <a
        href={shareLinks.twitter}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
      >
        <Twitter className="h-4 w-4" /> Twitter
      </a>
      <a
        href={shareLinks.linkedin}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors text-sm"
      >
        <Linkedin className="h-4 w-4" /> LinkedIn
      </a>
      <a
        href={shareLinks.email}
        className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
      >
        <Mail className="h-4 w-4" /> Email
      </a>
      <button
        onClick={copyToClipboard}
        className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
      >
        <Link2 className="h-4 w-4" /> Copiar enlace
      </button>
    </div>
  );
}
