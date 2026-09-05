import { useState } from "react";
import axios from "axios";

const PINATA_API_KEY = "7bf5cdd7d364fd2d8c23";
const PINATA_SECRET = "0a44d6b200a2578c76c437bc40db716d0f660848f8ad5d26d725566e8771b073";

function IPFSUpload({ onUpload }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [ipfsHash, setIpfsHash] = useState("");
  const [preview, setPreview] = useState("");

  async function uploadToIPFS() {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            pinata_api_key: PINATA_API_KEY,
            pinata_secret_api_key: PINATA_SECRET,
          },
        }
      );
      const hash = res.data.IpfsHash;
      setIpfsHash(hash);
      onUpload(hash);
    } catch (e) {
      alert("Upload failed: " + e.message);
    } finally {
      setUploading(false);
    }
  }

  function handleFile(e) {
    const f = e.target.files[0];
    setFile(f);
    if (f && f.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(f));
    }
  }

  return (
    <div className="border-2 border-dashed border-blue-200 rounded-xl p-4 mb-4 bg-blue-50">
      <p className="text-sm font-semibold text-blue-700 mb-2">📎 Attach Medical Document</p>
      <input type="file" onChange={handleFile} accept=".pdf,.jpg,.png,.jpeg"
        className="text-sm text-gray-600 mb-2 w-full" />
      {preview && (
        <img src={preview} alt="preview"
          className="h-24 rounded-lg mb-2 object-cover" />
      )}
      {file && (
        <button onClick={uploadToIPFS} disabled={uploading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 transition-all">
          {uploading ? "⏳ Uploading to IPFS..." : "☁️ Upload to IPFS"}
        </button>
      )}
      {ipfsHash && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-xs font-semibold text-green-700 mb-1">✅ Uploaded to IPFS!</p>
          <a href={`https://gateway.pinata.cloud/ipfs/${ipfsHash}`}
            target="_blank" rel="noreferrer"
            className="text-xs text-blue-600 underline break-all">
            📄 View Document: {ipfsHash}
          </a>
        </div>
      )}
    </div>
  );
}

export default IPFSUpload;