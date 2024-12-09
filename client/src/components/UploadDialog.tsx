import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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

    const validTypes = [
      'application/pdf',
      'text/html',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const isValidType = validTypes.some(type => 
      file.type.includes(type.split('/')[1]) || 
      (fileExtension && type.includes(fileExtension))
    );
    
    if (!isValidType) {
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Upload Tibetan Document</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Input
            type="file"
            accept=".pdf,.html,.txt,.doc,.docx"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
