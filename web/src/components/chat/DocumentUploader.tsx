// import React, {  useState } from 'react';
// import {  gql } from '@apollo/client';
// import { useMutation } from '@apollo/client/react';
// import { UploadCloud, FileText, Loader2 } from 'lucide-react';
// import { useToast } from '../ui/toastContext';

// const UPLOAD_DOCUMENT = gql`
//   mutation UploadDocument($file: Upload!) {
//     uploadDocument(file: $file) {
//       success
//       message
//     }
//   }
// `;

// export default function DocumentUploader() {
//   const { addToast } = useToast();
//   const [uploadDoc, { loading }] = useMutation(UPLOAD_DOCUMENT);
//   const [fileName, setFileName] = useState<string | null>(null);

//   const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (!file) return;

//     if (file.type !== 'application/pdf' && !file.type.startsWith('text/')) {
//       addToast({ type: 'error', title: 'Invalid File', message: 'Only PDF or Text files allowed.' });
//       return;
//     }

//     setFileName(file.name);

//     try {
//       addToast({ type: 'info', title: 'Uploading...', message: 'Reading document and generating embeddings...' });
      
//       const { data } = await uploadDoc({ variables: { file } });
      
//       if (data.uploadDocument.success) {
//         addToast({ type: 'success', title: 'Knowledge Added', message: data.uploadDocument.message });
//       } else {
//         addToast({ type: 'error', title: 'Error', message: data.uploadDocument.message });
//       }
//     } catch (err: any) {
//       console.error(err);
//       addToast({ type: 'error', title: 'Upload Failed', message: err.message });
//       setFileName(null);
//     }
//   };

//   return (
//     <div className="p-4 border-t border-slate-800 bg-slate-900/50">
//       <label className="flex items-center justify-center w-full p-4 border-2 border-dashed border-slate-700 rounded-xl cursor-pointer hover:border-violet-500 hover:bg-slate-800/50 transition-all group">
//         <input type="file" className="hidden" accept=".pdf,.txt" onChange={handleFileChange} disabled={loading} />
        
//         <div className="flex flex-col items-center gap-2 text-slate-400 group-hover:text-violet-300">
//           {loading ? (
//              <Loader2 className="animate-spin w-8 h-8" />
//           ) : fileName ? (
//              <FileText className="w-8 h-8 text-green-400" />
//           ) : (
//              <UploadCloud className="w-8 h-8" />
//           )}
          
//           <span className="text-sm font-medium">
//             {loading ? "Processing Knowledge..." : fileName ? fileName : "Drop PDF to Train Brain"}
//           </span>
//         </div>
//       </label>
//     </div>
//   );
// }

 export default function DocumentUploader() {

    return <div>Document Uploader Component</div>;
 }

