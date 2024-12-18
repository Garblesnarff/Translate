// client/src/components/UploadDialog.tsx

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface UploadDialogProps {
  onUpload: (file: File) => Promise<void>;
}

export default function UploadDialog({ onUpload }: UploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Helper function to check file type
    const isValidFileType = (file: File) => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      const mimeType = file.type.toLowerCase();
      
      // Check for PDF files (including browser-specific types)
      if (extension === 'pdf' || mimeType.includes('pdf')) return true;
      
      // Check for HTML files
      if (extension === 'html' || extension === 'htm' || mimeType.includes('html')) return true;
      
      // Check for text files
      if (extension === 'txt' || mimeType.includes('text/plain')) return true;
      
      // Check for Word documents
      if (['doc', 'docx'].includes(extension || '') || 
          mimeType.includes('msword') || 
          mimeType.includes('wordprocessingml')) return true;
      
      return false;
    };
    
    if (!isValidFileType(file)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF, HTML, TXT, or DOC/DOCX file",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      await onUpload(file);
      setOpen(false);
      toast({
        title: "Success",
        description: "PDF uploaded successfully",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to process PDF file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Upload PDF</Button>
      </DialogTrigger>
      <DialogContent 
        className="sm:max-w-[425px]"
        aria-describedby="upload-dialog-description"
      >
        <DialogHeader>
          <DialogTitle>Upload Tibetan Document</DialogTitle>
          <DialogDescription id="upload-dialog-description">
            Upload a document containing Tibetan text for translation. Supported formats: PDF, HTML, TXT, DOC/DOCX.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Input
            type="file"
            accept=".pdf,.html,.txt,.doc,.docx"
            onChange={handleFileChange}
            disabled={isUploading}
            aria-label="Choose file to upload"
            aria-describedby="file-input-description"
          />
          <p id="file-input-description" className="text-sm text-muted-foreground">
            Maximum file size: 50MB
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
