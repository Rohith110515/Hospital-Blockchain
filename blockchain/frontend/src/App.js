import { useState, useEffect } from "react";
import { ethers } from "ethers";
import HealthRecordsABI from "./HealthRecords.json";
import IPFSUpload from "./IPFSUpload";
import jsPDF from "jspdf";
import "jspdf-autotable";

const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

function App() {
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);
  const [patientName, setPatientName] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [doctorAddress, setDoctorAddress] = useState("");
  const [patientAddress, setPatientAddress] = useState("");
  const [viewPatientAddress, setViewPatientAddress] = useState("");
  const [records, setRecords] = useState([]);
  const [status, setStatus] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [role, setRole] = useState("patient");
  const [loading, setLoading] = useState(false);
  const [ipfsHash, setIpfsHash] = useState("");
  const [patientList, setPatientList] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState({ patients: 0, records: 0 });
  const [recordSearch, setRecordSearch] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [timeline, setTimeline] = useState([]);
  const [emergencyContact, setEmergencyContact] = useState("");
  const [emergencyActive, setEmergencyActive] = useState(false);

  // Medicine Reminder States
  const [reminders, setReminders] = useState(() => {
    const saved = localStorage.getItem("medReminders");
    return saved ? JSON.parse(saved) : [];
  });
  const [reminderName, setReminderName] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [reminderDose, setReminderDose] = useState("");
  const [reminderFreq, setReminderFreq] = useState("daily");
  const [reminderNotes, setReminderNotes] = useState("");

  const d = darkMode;

  // Save reminders to localStorage
  useEffect(() => {
    localStorage.setItem("medReminders", JSON.stringify(reminders));
  }, [reminders]);

  // Check reminders every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      reminders.forEach(r => {
        if (r.active && r.time === currentTime) {
          if (Notification.permission === "granted") {
            new Notification("💊 Medicine Reminder", {
              body: `Time to take ${r.name} - ${r.dose}`,
              icon: "🏥"
            });
          }
        }
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [reminders]);

  async function connectWallet() {
    try {
      if (!window.ethereum) { alert("Please install MetaMask!"); return; }
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x7A69" }],
      });
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const addr = await signer.getAddress();
      setAccount(addr);
      const c = new ethers.Contract(CONTRACT_ADDRESS, HealthRecordsABI.abi, signer);
      setContract(c);
      const registered = await c.isRegistered(addr);
      setIsRegistered(registered);
      setStatus(registered ? "success:Connected & Registered!" : "info:Wallet connected! Please register.");
      try {
        const list = await c.getAllPatients();
        setStats(prev => ({ ...prev, patients: list.length }));
        setPatientList(list);
      } catch (e) {}
      setActiveTab("dashboard");
      Notification.requestPermission();
    } catch (e) {
      setStatus("error:" + (e.message || "Connection failed"));
    }
  }

  async function registerPatient() {
    if (!contract || !patientName) { setStatus("error:Enter your name!"); return; }
    try {
      setLoading(true);
      setStatus("info:Registering... confirm in MetaMask");
      const tx = await contract.registerPatient(patientName);
      await tx.wait();
      setIsRegistered(true);
      setStatus("success:Registered successfully!");
      const list = await contract.getAllPatients();
      setStats(prev => ({ ...prev, patients: list.length }));
    } catch (e) {
      setStatus("error:" + e.message);
    } finally { setLoading(false); }
  }

  async function authorizeDoctor() {
    if (!contract || !doctorAddress) { setStatus("error:Enter doctor address!"); return; }
    try {
      setLoading(true);
      setStatus("info:Authorizing doctor...");
      const tx = await contract.authorizeDoctor(doctorAddress);
      await tx.wait();
      setStatus("success:Doctor authorized!");
      setDoctorAddress("");
    } catch (e) {
      setStatus("error:" + e.message);
    } finally { setLoading(false); }
  }

  async function revokeDoctor() {
    if (!contract || !doctorAddress) { setStatus("error:Enter doctor address!"); return; }
    try {
      setLoading(true);
      setStatus("info:Revoking access...");
      const tx = await contract.revokeDoctor(doctorAddress);
      await tx.wait();
      setStatus("success:Doctor access revoked!");
      setDoctorAddress("");
    } catch (e) {
      setStatus("error:" + e.message);
    } finally { setLoading(false); }
  }

  async function addRecord() {
    if (!contract || !diagnosis || !treatment || !doctorName) {
      setStatus("error:Fill all fields!"); return;
    }
    const target = role === "doctor" ? patientAddress : account;
    if (role === "doctor" && !patientAddress) { setStatus("error:Enter patient address!"); return; }
    try {
      setLoading(true);
      setStatus("info:Adding record... confirm in MetaMask");
      const tx = await contract.addRecord(target, diagnosis, treatment, doctorName);
      await tx.wait();
      setStatus("success:Record added to blockchain!");
      setDiagnosis(""); setTreatment(""); setDoctorName(""); setIpfsHash("");
      setStats(prev => ({ ...prev, records: prev.records + 1 }));
    } catch (e) {
      setStatus("error:" + e.message);
    } finally { setLoading(false); }
  }

  async function getRecords() {
    if (!contract) { setStatus("error:Connect wallet first!"); return; }
    const target = role === "doctor" ? viewPatientAddress : account;
    if (role === "doctor" && !viewPatientAddress) { setStatus("error:Enter patient address!"); return; }
    try {
      setLoading(true);
      setStatus("info:Loading records...");
      const recs = await contract.getRecords(target);
      setRecords(recs);
      setStats(prev => ({ ...prev, records: recs.length }));
      setStatus("success:" + recs.length + " record(s) loaded!");
    } catch (e) {
      setStatus("error:" + e.message);
    } finally { setLoading(false); }
  }

  async function getAllPatients() {
    if (!contract) { setStatus("error:Connect wallet first!"); return; }
    try {
      setLoading(true);
      setStatus("info:Loading patients...");
      const list = await contract.getAllPatients();
      setPatientList(list);
      setStats(prev => ({ ...prev, patients: list.length }));
      setStatus("success:" + list.length + " patient(s) found!");
    } catch (e) {
      setStatus("error:" + e.message);
    } finally { setLoading(false); }
  }

  async function getStats() {
    if (!contract) return;
    try {
      setLoading(true);
      setStatus("info:Refreshing stats...");
      const list = await contract.getAllPatients();
      let totalRecords = 0;
      for (let p of list) {
        try {
          const recs = await contract.getRecords(p);
          totalRecords += recs.length;
        } catch (e) {}
      }
      setStats({ patients: list.length, records: totalRecords });
      setPatientList(list);
      setStatus("success:Stats updated!");
    } catch (e) {
      setStatus("error:" + e.message);
    } finally { setLoading(false); }
  }

  function exportPDF() {
    if (records.length === 0) { setStatus("error:No records to export!"); return; }
    const doc = new jsPDF();
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 35, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Healthcare Blockchain", 14, 15);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Decentralized Medical Records System", 14, 23);
    doc.text("Generated: " + new Date().toLocaleString(), 14, 30);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Patient Information", 14, 45);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Wallet: " + account, 14, 53);
    doc.text("Total Records: " + records.length, 14, 60);
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.5);
    doc.line(14, 65, 196, 65);
    doc.autoTable({
      startY: 70,
      head: [["#", "Diagnosis", "Treatment", "Doctor", "Date"]],
      body: records.map((r, i) => [
        i + 1, r.diagnosis, r.treatment, r.doctorName,
        new Date(r.timestamp.toNumber() * 1000).toLocaleDateString()
      ]),
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold", fontSize: 10 },
      bodyStyles: { fontSize: 9, textColor: [50, 50, 50] },
      alternateRowStyles: { fillColor: [239, 246, 255] },
      columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 45 }, 2: { cellWidth: 55 }, 3: { cellWidth: 35 }, 4: { cellWidth: 35 } },
      margin: { left: 14, right: 14 }
    });
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text("Secured by Ethereum Blockchain • Built for SIH 2026 • Page " + i + " of " + pageCount, 14, doc.internal.pageSize.height - 10);
    }
    doc.save("medical-records-" + account.slice(0, 6) + ".pdf");
    setStatus("success:PDF exported successfully!");
  }

  async function buildTimeline() {
    if (!contract) { setStatus("error:Connect wallet first!"); return; }
    try {
      setLoading(true);
      setStatus("info:Building timeline...");
      const events = [];
      const regEvents = await contract.queryFilter(contract.filters.PatientRegistered());
      regEvents.forEach(e => events.push({ type: "registered", icon: "🙋", title: "Patient Registered", desc: `${e.args.patient.slice(0,6)}...${e.args.patient.slice(-4)} joined`, color: "blue", time: e.blockNumber, tx: e.transactionHash }));
      const recEvents = await contract.queryFilter(contract.filters.RecordAdded());
      recEvents.forEach(e => events.push({ type: "record", icon: "📋", title: "Medical Record Added", desc: `Record #${e.args.recordId.toString()} added for ${e.args.patient.slice(0,6)}...${e.args.patient.slice(-4)}`, color: "green", time: e.blockNumber, tx: e.transactionHash }));
      const authEvents = await contract.queryFilter(contract.filters.DoctorAuthorized());
      authEvents.forEach(e => events.push({ type: "authorized", icon: "✅", title: "Doctor Authorized", desc: `Doctor ${e.args.doctor.slice(0,6)}...${e.args.doctor.slice(-4)} authorized`, color: "purple", time: e.blockNumber, tx: e.transactionHash }));
      const revEvents = await contract.queryFilter(contract.filters.DoctorRevoked());
      revEvents.forEach(e => events.push({ type: "revoked", icon: "❌", title: "Doctor Revoked", desc: `Doctor ${e.args.doctor.slice(0,6)}...${e.args.doctor.slice(-4)} revoked`, color: "red", time: e.blockNumber, tx: e.transactionHash }));
      events.sort((a, b) => b.time - a.time);
      setTimeline(events);
      setStatus("success:" + events.length + " activities found!");
    } catch (e) {
      setStatus("error:" + e.message);
    } finally { setLoading(false); }
  }

  async function setEmergencyContactFn() {
    if (!contract || !emergencyContact) { setStatus("error:Enter emergency contact address!"); return; }
    try {
      setLoading(true);
      setStatus("info:Setting emergency contact...");
      const tx = await contract.setEmergencyContact(emergencyContact);
      await tx.wait();
      setStatus("success:Emergency contact set!");
    } catch (e) {
      setStatus("error:" + e.message);
    } finally { setLoading(false); }
  }

  async function toggleEmergencyFn() {
    if (!contract) return;
    try {
      setLoading(true);
      const newState = !emergencyActive;
      setStatus("info:Updating emergency access...");
      const tx = await contract.toggleEmergencyAccess(newState);
      await tx.wait();
      setEmergencyActive(newState);
      setStatus("success:Emergency access " + (newState ? "activated!" : "deactivated!"));
    } catch (e) {
      setStatus("error:" + e.message);
    } finally { setLoading(false); }
  }

  function addReminder() {
    if (!reminderName || !reminderTime || !reminderDose) {
      setStatus("error:Fill medicine name, time and dose!"); return;
    }
    const newReminder = {
      id: Date.now(),
      name: reminderName,
      time: reminderTime,
      dose: reminderDose,
      freq: reminderFreq,
      notes: reminderNotes,
      active: true,
      createdAt: new Date().toLocaleDateString()
    };
    setReminders(prev => [...prev, newReminder]);
    setReminderName(""); setReminderTime(""); setReminderDose("");
    setReminderFreq("daily"); setReminderNotes("");
    setStatus("success:Medicine reminder added!");
  }

  function toggleReminder(id) {
    setReminders(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r));
  }

  function deleteReminder(id) {
    setReminders(prev => prev.filter(r => r.id !== id));
    setStatus("success:Reminder deleted!");
  }

  function requestNotificationPermission() {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        setStatus("success:Notifications enabled! You'll be reminded at medicine times.");
      } else {
        setStatus("error:Please allow notifications for reminders to work.");
      }
    });
  }

  const statusType = status.split(":")[0];
  const statusMsg = status.split(":").slice(1).join(":");
  const statusColors = {
    success: d ? "bg-green-900 border-green-500 text-green-300" : "bg-green-50 border-green-400 text-green-800",
    error: d ? "bg-red-900 border-red-500 text-red-300" : "bg-red-50 border-red-400 text-red-800",
    info: d ? "bg-blue-900 border-blue-500 text-blue-300" : "bg-blue-50 border-blue-400 text-blue-800",
  };
  const statusIcons = { success: "✅", error: "❌", info: "⏳" };

  const tabList = [
    "dashboard", "records", "add",
    ...(role === "patient" ? ["doctors", "emergency", "reminders"] : []),
    "patients", "profile", "timeline"
  ];

  const tabLabels = {
    dashboard: "📊 Dashboard", records: "📋 Records", add: "➕ Add",
    doctors: "👨‍⚕️ Doctors", emergency: "🚨 Emergency", reminders: "💊 Reminders",
    patients: "👥 Patients", profile: "👤 Profile", timeline: "⏱️ Timeline"
  };

  const filteredRecords = records.filter(r =>
    r.diagnosis.toLowerCase().includes(recordSearch.toLowerCase()) ||
    r.treatment.toLowerCase().includes(recordSearch.toLowerCase()) ||
    r.doctorName.toLowerCase().includes(recordSearch.toLowerCase())
  );

  const bg = d ? "bg-gray-900" : "bg-gradient-to-br from-blue-50 to-indigo-100";
  const headerBg = d ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const cardBg = d ? "bg-gray-800" : "bg-white";
  const textPrimary = d ? "text-white" : "text-gray-800";
  const textSecondary = d ? "text-gray-400" : "text-gray-500";
  const textMuted = d ? "text-gray-500" : "text-gray-400";
  const inputClass = d
    ? "w-full bg-gray-700 border border-gray-600 text-white placeholder-gray-400 rounded-xl px-4 py-3 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
    : "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-300";
  const tabActive = d ? "bg-gray-700 text-blue-400 shadow-md" : "bg-white shadow-md text-blue-600";
  const tabInactive = d ? "text-gray-400 hover:bg-gray-700" : "text-gray-500 hover:bg-white hover:shadow-sm";
  const timelineColors = {
    blue: d ? "bg-blue-900 border-blue-700 text-blue-300" : "bg-blue-50 border-blue-200 text-blue-700",
    green: d ? "bg-green-900 border-green-700 text-green-300" : "bg-green-50 border-green-200 text-green-700",
    purple: d ? "bg-purple-900 border-purple-700 text-purple-300" : "bg-purple-50 border-purple-200 text-purple-700",
    red: d ? "bg-red-900 border-red-700 text-red-300" : "bg-red-50 border-red-200 text-red-700",
  };
  const dotColors = { blue: "bg-blue-500", green: "bg-green-500", purple: "bg-purple-500", red: "bg-red-500" };
  const freqColors = { daily: "bg-blue-100 text-blue-700", twice: "bg-green-100 text-green-700", weekly: "bg-purple-100 text-purple-700", custom: "bg-orange-100 text-orange-700" };

  return (
    <div className={`min-h-screen transition-all duration-300 ${bg}`}>

      {/* Header */}
      <div className={`shadow-sm border-b ${headerBg}`}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-xl text-2xl">🏥</div>
            <div>
              <h1 className={`text-xl font-bold ${textPrimary}`}>Healthcare Blockchain</h1>
              <p className={`text-xs ${textSecondary}`}>Decentralized Medical Records System</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setDarkMode(!d)}
              className={`p-2 rounded-xl border transition-all text-xl ${d ? "border-gray-600 hover:bg-gray-700" : "border-gray-200 hover:bg-gray-100"}`}>
              {d ? "☀️" : "🌙"}
            </button>
            <button onClick={connectWallet}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-md">
              {account ? (
                <><span className="w-2 h-2 bg-green-400 rounded-full"></span>{account.slice(0, 6)}...{account.slice(-4)}</>
              ) : "🔗 Connect Wallet"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Status */}
        {status && (
          <div className={`border-l-4 rounded-lg p-4 mb-6 flex items-center gap-3 ${statusColors[statusType]}`}>
            <span className="text-lg">{statusIcons[statusType]}</span>
            <p className="font-medium text-sm">{statusMsg}</p>
            {loading && <div className="ml-auto w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
          </div>
        )}

        {/* Role Selector */}
        {account && (
          <div className={`rounded-2xl shadow-sm p-2 mb-6 flex gap-2 ${cardBg}`}>
            <button onClick={() => { setRole("patient"); setRecords([]); setActiveTab("dashboard"); }}
              className={`flex-1 py-3 rounded-xl font-medium text-sm transition-all ${role === "patient" ? "bg-blue-600 text-white shadow-md" : d ? "text-gray-400 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-50"}`}>
              🙋 I am a Patient
            </button>
            <button onClick={() => { setRole("doctor"); setRecords([]); setActiveTab("dashboard"); }}
              className={`flex-1 py-3 rounded-xl font-medium text-sm transition-all ${role === "doctor" ? "bg-indigo-600 text-white shadow-md" : d ? "text-gray-400 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-50"}`}>
              👨‍⚕️ I am a Doctor
            </button>
          </div>
        )}

        {/* Doctor Info */}
        {role === "doctor" && account && (
          <div className={`border rounded-2xl p-4 mb-6 ${d ? "bg-indigo-900 border-indigo-700" : "bg-indigo-50 border-indigo-200"}`}>
            <p className={`font-semibold mb-1 ${d ? "text-indigo-300" : "text-indigo-800"}`}>👨‍⚕️ Doctor Mode Active</p>
            <p className={`text-xs break-all ${d ? "text-indigo-400" : "text-indigo-600"}`}>Your address: {account}</p>
            <p className={`text-xs mt-1 ${d ? "text-indigo-500" : "text-indigo-500"}`}>Ask your patient to authorize your address.</p>
          </div>
        )}

        {/* Register */}
        {!isRegistered && account && role === "patient" && (
          <div className={`rounded-2xl shadow-sm p-6 mb-6 ${cardBg}`}>
            <h2 className={`text-lg font-bold mb-4 ${textPrimary}`}>👤 Register as Patient</h2>
            <input placeholder="Your full name" value={patientName} onChange={e => setPatientName(e.target.value)} className={inputClass} />
            <button onClick={registerPatient} disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium text-sm transition-all shadow-md disabled:opacity-50">
              Register on Blockchain
            </button>
          </div>
        )}

        {/* Tabs */}
        {(isRegistered || role === "doctor") && account && (
          <>
            <div className="flex gap-2 mb-6 flex-wrap">
              {tabList.map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${activeTab === tab ? tabActive : tabInactive}`}>
                  {tabLabels[tab]}
                </button>
              ))}
            </div>

            {/* Dashboard */}
            {activeTab === "dashboard" && (
              <div>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {[
                    { icon: "👥", value: stats.patients, label: "Total Patients", color: "text-blue-500" },
                    { icon: "📋", value: stats.records, label: "Total Records", color: "text-green-500" },
                    { icon: "💊", value: reminders.filter(r => r.active).length, label: "Active Reminders", color: "text-purple-500" },
                  ].map(({ icon, value, label, color }) => (
                    <div key={label} className={`rounded-2xl shadow-sm p-6 text-center ${cardBg}`}>
                      <div className="text-4xl mb-2">{icon}</div>
                      <p className={`text-3xl font-bold ${color}`}>{value}</p>
                      <p className={`text-sm mt-1 ${textSecondary}`}>{label}</p>
                    </div>
                  ))}
                </div>

                <div className={`rounded-2xl shadow-sm p-6 mb-6 ${cardBg}`}>
                  <h2 className={`text-lg font-bold mb-4 ${textPrimary}`}>⛓️ Blockchain Info</h2>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Network", value: "Localhost 8545", bg: d ? "bg-blue-900" : "bg-blue-50", text: d ? "text-blue-300" : "text-blue-500", val: d ? "text-blue-100" : "text-gray-800" },
                      { label: "Contract", value: CONTRACT_ADDRESS, bg: d ? "bg-green-900" : "bg-green-50", text: d ? "text-green-300" : "text-green-500", val: d ? "text-green-100" : "text-gray-600", mono: true },
                      { label: "Your Address", value: account, bg: d ? "bg-purple-900" : "bg-purple-50", text: d ? "text-purple-300" : "text-purple-500", val: d ? "text-purple-100" : "text-gray-600", mono: true },
                      { label: "Role", value: role === "patient" ? "🙋 Patient" : "👨‍⚕️ Doctor", bg: d ? "bg-yellow-900" : "bg-yellow-50", text: d ? "text-yellow-300" : "text-yellow-600", val: d ? "text-yellow-100" : "text-gray-800" },
                    ].map(({ label, value, bg, text, val, mono }) => (
                      <div key={label} className={`rounded-xl p-4 ${bg}`}>
                        <p className={`text-xs font-medium mb-1 ${text}`}>{label}</p>
                        <p className={`text-sm font-bold truncate ${val} ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`rounded-2xl shadow-sm p-6 mb-6 ${cardBg}`}>
                  <h2 className={`text-lg font-bold mb-4 ${textPrimary}`}>⚡ Quick Actions</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: "➕", title: "Add Record", sub: "Add new medical record", tab: "add", bg: d ? "bg-green-900 border-green-700 hover:bg-green-800" : "bg-green-50 hover:bg-green-100 border-green-200" },
                      { icon: "📋", title: "View Records", sub: "See all medical history", tab: "records", bg: d ? "bg-purple-900 border-purple-700 hover:bg-purple-800" : "bg-purple-50 hover:bg-purple-100 border-purple-200" },
                      { icon: "💊", title: "Medicine Reminders", sub: "Manage your medicines", tab: "reminders", bg: d ? "bg-pink-900 border-pink-700 hover:bg-pink-800" : "bg-pink-50 hover:bg-pink-100 border-pink-200" },
                      { icon: "🚨", title: "Emergency Access", sub: "Set emergency contact", tab: "emergency", bg: d ? "bg-red-900 border-red-700 hover:bg-red-800" : "bg-red-50 hover:bg-red-100 border-red-200" },
                    ].map(({ icon, title, sub, tab, bg }) => (
                      <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`border rounded-xl p-4 text-left transition-all ${bg}`}>
                        <p className="text-2xl mb-1">{icon}</p>
                        <p className={`font-semibold text-sm ${textPrimary}`}>{title}</p>
                        <p className={`text-xs ${textSecondary}`}>{sub}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={getStats} disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium text-sm transition-all shadow-md disabled:opacity-50">
                  🔄 Refresh Stats
                </button>
              </div>
            )}

            {/* Records */}
            {activeTab === "records" && (
              <div className={`rounded-2xl shadow-sm p-6 ${cardBg}`}>
                <h2 className={`text-lg font-bold mb-4 ${textPrimary}`}>📋 Medical Records</h2>
                {role === "doctor" && (
                  <input placeholder="Patient wallet address (0x...)" value={viewPatientAddress} onChange={e => setViewPatientAddress(e.target.value)} className={inputClass} />
                )}
                <div className="flex gap-3 mb-4">
                  <button onClick={getRecords} disabled={loading}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-medium text-sm transition-all shadow-md disabled:opacity-50">
                    Load Records
                  </button>
                  {records.length > 0 && (
                    <button onClick={exportPDF}
                      className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-medium text-sm transition-all shadow-md">
                      📄 Export PDF
                    </button>
                  )}
                </div>
                {records.length > 0 && (
                  <div className="relative mb-3">
                    <input placeholder="🔍 Search diagnosis, treatment, doctor..."
                      value={recordSearch} onChange={e => setRecordSearch(e.target.value)}
                      className={inputClass} style={{ marginBottom: 0 }} />
                    {recordSearch && (
                      <button onClick={() => setRecordSearch("")} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 text-lg">×</button>
                    )}
                  </div>
                )}
                {records.length > 0 && <p className={`text-xs mb-4 ${textMuted}`}>Showing {filteredRecords.length} of {records.length} records</p>}
                <div className="space-y-4">
                  {records.length === 0
                    ? <div className={`text-center py-12 ${textMuted}`}><p className="text-4xl mb-3">📭</p><p>No records. Click Load Records.</p></div>
                    : filteredRecords.length === 0
                    ? <div className={`text-center py-12 ${textMuted}`}>
                        <p className="text-4xl mb-3">🔍</p>
                        <p>No match for "<strong>{recordSearch}</strong>"</p>
                        <button onClick={() => setRecordSearch("")} className="mt-3 text-blue-500 text-sm underline">Clear</button>
                      </div>
                    : filteredRecords.map((r, i) => (
                      <div key={i} className={`border rounded-xl p-5 transition-all ${d ? "border-gray-700 hover:bg-gray-750" : "border-gray-100 hover:shadow-md"}`}>
                        <div className="flex justify-between items-start mb-3">
                          <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full">Record #{i + 1}</span>
                          <span className={`text-xs ${textMuted}`}>{new Date(r.timestamp.toNumber() * 1000).toLocaleString()}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className={`rounded-xl p-3 ${d ? "bg-red-900" : "bg-red-50"}`}>
                            <p className={`text-xs font-medium mb-1 ${d ? "text-red-300" : "text-red-500"}`}>🩺 Diagnosis</p>
                            <p className={`text-sm font-semibold ${d ? "text-red-100" : "text-gray-800"}`}>{r.diagnosis}</p>
                          </div>
                          <div className={`rounded-xl p-3 ${d ? "bg-green-900" : "bg-green-50"}`}>
                            <p className={`text-xs font-medium mb-1 ${d ? "text-green-300" : "text-green-500"}`}>💊 Treatment</p>
                            <p className={`text-sm font-semibold ${d ? "text-green-100" : "text-gray-800"}`}>{r.treatment}</p>
                          </div>
                          <div className={`rounded-xl p-3 ${d ? "bg-blue-900" : "bg-blue-50"}`}>
                            <p className={`text-xs font-medium mb-1 ${d ? "text-blue-300" : "text-blue-500"}`}>👨‍⚕️ Doctor</p>
                            <p className={`text-sm font-semibold ${d ? "text-blue-100" : "text-gray-800"}`}>{r.doctorName}</p>
                          </div>
                          <div className={`rounded-xl p-3 ${d ? "bg-purple-900" : "bg-purple-50"}`}>
                            <p className={`text-xs font-medium mb-1 ${d ? "text-purple-300" : "text-purple-500"}`}>🔑 Address</p>
                            <p className={`text-xs font-mono truncate ${d ? "text-purple-100" : "text-gray-600"}`}>{r.doctor}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}

            {/* Add Record */}
            {activeTab === "add" && (
              <div className={`rounded-2xl shadow-sm p-6 ${cardBg}`}>
                <h2 className={`text-lg font-bold mb-4 ${textPrimary}`}>➕ Add Medical Record</h2>
                {role === "doctor" && (
                  <input placeholder="Patient wallet address (0x...)" value={patientAddress} onChange={e => setPatientAddress(e.target.value)} className={inputClass} />
                )}
                {[
                  { val: diagnosis, set: setDiagnosis, ph: "Diagnosis (e.g. Fever, Diabetes)" },
                  { val: treatment, set: setTreatment, ph: "Treatment (e.g. Paracetamol 500mg)" },
                  { val: doctorName, set: setDoctorName, ph: "Doctor Name" },
                ].map(({ val, set, ph }) => (
                  <input key={ph} placeholder={ph} value={val} onChange={e => set(e.target.value)} className={inputClass} />
                ))}
                <IPFSUpload onUpload={(hash) => setIpfsHash(hash)} />
                {ipfsHash && <p className="text-xs text-green-500 mb-3">📎 Attached: {ipfsHash.slice(0, 20)}...</p>}
                <button onClick={addRecord} disabled={loading}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-medium text-sm transition-all shadow-md disabled:opacity-50">
                  Add to Blockchain
                </button>
              </div>
            )}

            {/* Doctors */}
            {activeTab === "doctors" && role === "patient" && (
              <div className={`rounded-2xl shadow-sm p-6 ${cardBg}`}>
                <h2 className={`text-lg font-bold mb-2 ${textPrimary}`}>👨‍⚕️ Manage Doctor Access</h2>
                <p className={`text-sm mb-4 ${textSecondary}`}>Control which doctors can access your records.</p>
                <input placeholder="Doctor wallet address (0x...)" value={doctorAddress} onChange={e => setDoctorAddress(e.target.value)} className={inputClass} />
                <div className="flex gap-3 mb-6">
                  <button onClick={authorizeDoctor} disabled={loading}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-50">
                    ✅ Authorize
                  </button>
                  <button onClick={revokeDoctor} disabled={loading}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-50">
                    ❌ Revoke
                  </button>
                </div>
                <div className={`border rounded-xl p-4 ${d ? "bg-blue-900 border-blue-700" : "bg-blue-50 border-blue-100"}`}>
                  <p className={`text-xs font-semibold mb-2 ${d ? "text-blue-300" : "text-blue-700"}`}>Your Patient Address:</p>
                  <p className={`text-xs font-mono break-all ${d ? "text-blue-200" : "text-blue-600"}`}>{account}</p>
                </div>
              </div>
            )}

            {/* Emergency */}
            {activeTab === "emergency" && role === "patient" && (
              <div className={`rounded-2xl shadow-sm p-6 ${cardBg}`}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-red-100 p-3 rounded-xl"><span className="text-3xl">🚨</span></div>
                  <div>
                    <h2 className={`text-lg font-bold ${textPrimary}`}>Emergency Access</h2>
                    <p className={`text-sm ${textSecondary}`}>Set who can access your records in emergencies</p>
                  </div>
                </div>

                <div className={`border rounded-xl p-5 mb-6 ${emergencyActive
                  ? d ? "bg-red-900 border-red-700" : "bg-red-50 border-red-200"
                  : d ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className={`font-semibold ${emergencyActive ? d ? "text-red-300" : "text-red-700" : textPrimary}`}>
                        🚨 Emergency Access
                      </p>
                      <p className={`text-xs mt-1 ${emergencyActive ? d ? "text-red-400" : "text-red-500" : textSecondary}`}>
                        {emergencyActive ? "ACTIVE — Emergency contact can view your records" : "Inactive — Normal access rules apply"}
                      </p>
                    </div>
                    <button onClick={toggleEmergencyFn} disabled={loading}
                      className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${emergencyActive ? "bg-red-600 hover:bg-red-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}`}>
                      {emergencyActive ? "🔴 Deactivate" : "🟢 Activate"}
                    </button>
                  </div>
                </div>

                <div className={`border rounded-xl p-5 mb-6 ${d ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"}`}>
                  <h3 className={`font-semibold mb-3 ${textPrimary}`}>👤 Emergency Contact</h3>
                  <p className={`text-xs mb-3 ${textSecondary}`}>This person can access your records when emergency is active.</p>
                  <input placeholder="Emergency contact wallet address (0x...)"
                    value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} className={inputClass} />
                  <button onClick={setEmergencyContactFn} disabled={loading}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-medium text-sm transition-all shadow-md disabled:opacity-50">
                    💾 Save Emergency Contact
                  </button>
                </div>

                <div className={`border rounded-xl p-4 ${d ? "bg-yellow-900 border-yellow-700" : "bg-yellow-50 border-yellow-200"}`}>
                  <p className={`font-semibold mb-2 ${d ? "text-yellow-300" : "text-yellow-700"}`}>⚠️ Important</p>
                  <ul className={`text-xs space-y-1 ${d ? "text-yellow-400" : "text-yellow-600"}`}>
                    <li>• Only activate in genuine emergencies</li>
                    <li>• Your emergency contact can view ALL records</li>
                    <li>• Deactivate as soon as emergency is over</li>
                    <li>• All access is permanently logged on blockchain</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Medicine Reminders */}
            {activeTab === "reminders" && role === "patient" && (
              <div>
                {/* Notification Permission */}
                {Notification.permission !== "granted" && (
                  <div className={`border rounded-xl p-4 mb-6 ${d ? "bg-yellow-900 border-yellow-700" : "bg-yellow-50 border-yellow-200"}`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className={`font-semibold ${d ? "text-yellow-300" : "text-yellow-700"}`}>🔔 Enable Notifications</p>
                        <p className={`text-xs mt-1 ${d ? "text-yellow-400" : "text-yellow-600"}`}>Allow notifications to get medicine reminders</p>
                      </div>
                      <button onClick={requestNotificationPermission}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-xl text-sm font-medium">
                        Enable
                      </button>
                    </div>
                  </div>
                )}

                {/* Add Reminder */}
                <div className={`rounded-2xl shadow-sm p-6 mb-6 ${cardBg}`}>
                  <h2 className={`text-lg font-bold mb-4 ${textPrimary}`}>💊 Add Medicine Reminder</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="Medicine name" value={reminderName} onChange={e => setReminderName(e.target.value)}
                      className={inputClass} />
                    <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)}
                      className={inputClass} />
                    <input placeholder="Dose (e.g. 500mg)" value={reminderDose} onChange={e => setReminderDose(e.target.value)}
                      className={inputClass} />
                    <select value={reminderFreq} onChange={e => setReminderFreq(e.target.value)}
                      className={inputClass}>
                      <option value="daily">Daily</option>
                      <option value="twice">Twice Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <input placeholder="Notes (optional)" value={reminderNotes} onChange={e => setReminderNotes(e.target.value)}
                    className={inputClass} />
                  <button onClick={addReminder}
                    className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-3 rounded-xl font-medium text-sm transition-all shadow-md">
                    ➕ Add Reminder
                  </button>
                </div>

                {/* Reminder List */}
                <div className={`rounded-2xl shadow-sm p-6 ${cardBg}`}>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className={`text-lg font-bold ${textPrimary}`}>📋 My Reminders</h2>
                    <span className={`text-xs px-3 py-1 rounded-full ${d ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
                      {reminders.filter(r => r.active).length} active
                    </span>
                  </div>

                  {reminders.length === 0
                    ? <div className={`text-center py-12 ${textMuted}`}>
                        <p className="text-4xl mb-3">💊</p>
                        <p>No reminders yet. Add your first medicine!</p>
                      </div>
                    : reminders.map(r => (
                      <div key={r.id} className={`border rounded-xl p-4 mb-3 transition-all ${r.active
                        ? d ? "border-pink-700 bg-pink-900" : "border-pink-200 bg-pink-50"
                        : d ? "border-gray-700 bg-gray-700 opacity-60" : "border-gray-200 bg-gray-50 opacity-60"}`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">💊</span>
                            <div>
                              <p className={`font-bold text-sm ${d ? "text-pink-200" : "text-pink-800"}`}>{r.name}</p>
                              <p className={`text-xs ${textSecondary}`}>{r.dose}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${freqColors[r.freq]}`}>
                              {r.freq}
                            </span>
                            <span className={`text-lg font-bold ${d ? "text-pink-300" : "text-pink-600"}`}>⏰ {r.time}</span>
                          </div>
                        </div>
                        {r.notes && <p className={`text-xs mb-2 ${textSecondary}`}>📝 {r.notes}</p>}
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => toggleReminder(r.id)}
                            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${r.active
                              ? "bg-gray-200 hover:bg-gray-300 text-gray-700"
                              : "bg-green-500 hover:bg-green-600 text-white"}`}>
                            {r.active ? "⏸ Pause" : "▶ Resume"}
                          </button>
                          <button onClick={() => deleteReminder(r.id)}
                            className="flex-1 py-2 rounded-lg text-xs font-medium bg-red-500 hover:bg-red-600 text-white transition-all">
                            🗑 Delete
                          </button>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}

            {/* Patients */}
            {activeTab === "patients" && (
              <div className={`rounded-2xl shadow-sm p-6 ${cardBg}`}>
                <h2 className={`text-lg font-bold mb-4 ${textPrimary}`}>👥 Patient Directory</h2>
                <div className="flex gap-3 mb-6">
                  <input placeholder="Search by address..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    className={`flex-1 ${inputClass}`} style={{ marginBottom: 0 }} />
                  <button onClick={getAllPatients} disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-50">
                    Load
                  </button>
                </div>
                {patientList.length === 0
                  ? <div className={`text-center py-12 ${textMuted}`}><p className="text-4xl mb-3">👥</p><p>Click Load to see patients.</p></div>
                  : patientList.filter(p => p.toLowerCase().includes(searchTerm.toLowerCase())).map((p, i) => (
                    <div key={i} className={`flex items-center justify-between border rounded-xl p-4 mb-3 transition-all ${d ? "border-gray-700 hover:bg-gray-700" : "border-gray-100 hover:shadow-md"}`}>
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-100 text-blue-700 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm">{i + 1}</div>
                        <div>
                          <p className={`text-xs font-mono ${d ? "text-gray-300" : "text-gray-600"}`}>{p}</p>
                          <p className={`text-xs ${textMuted}`}>Patient #{i + 1}</p>
                        </div>
                      </div>
                      <button onClick={() => { setViewPatientAddress(p); setActiveTab("records"); }}
                        className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-medium">
                        View →
                      </button>
                    </div>
                  ))
                }
                <div className={`mt-4 rounded-xl p-3 text-center ${d ? "bg-gray-700" : "bg-gray-50"}`}>
                  <p className={`text-sm ${textSecondary}`}>Total: <span className="font-bold text-blue-500">{patientList.length}</span></p>
                </div>
              </div>
            )}

            {/* Profile */}
            {activeTab === "profile" && (
              <div className={`rounded-2xl shadow-sm p-6 ${cardBg}`}>
                <h2 className={`text-lg font-bold mb-6 ${textPrimary}`}>👤 Patient Profile</h2>
                <div className="flex flex-col items-center mb-8">
                  <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center text-4xl text-white mb-3 shadow-lg">
                    {role === "patient" ? "🙋" : "👨‍⚕️"}
                  </div>
                  <h3 className={`text-xl font-bold ${textPrimary}`}>{role === "patient" ? "Patient" : "Doctor"}</h3>
                  <p className={`text-xs font-mono mt-1 ${textSecondary}`}>{account}</p>
                  <span className={`mt-2 px-3 py-1 rounded-full text-xs font-medium ${isRegistered ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {isRegistered ? "✅ Registered" : "⚠️ Not Registered"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[
                    { value: stats.patients, label: "Network Patients", bg: d ? "bg-blue-900" : "bg-blue-50", color: d ? "text-blue-300" : "text-blue-600" },
                    { value: records.length, label: "My Records", bg: d ? "bg-green-900" : "bg-green-50", color: d ? "text-green-300" : "text-green-600" },
                    { value: reminders.filter(r => r.active).length, label: "Active Reminders", bg: d ? "bg-pink-900" : "bg-pink-50", color: d ? "text-pink-300" : "text-pink-600" },
                  ].map(({ value, label, bg, color }) => (
                    <div key={label} className={`rounded-xl p-4 text-center ${bg}`}>
                      <p className={`text-2xl font-bold ${color}`}>{value}</p>
                      <p className={`text-xs mt-1 ${textSecondary}`}>{label}</p>
                    </div>
                  ))}
                </div>
                <div className={`rounded-xl p-5 mb-4 ${d ? "bg-gray-700" : "bg-gray-50"}`}>
                  <h3 className={`font-semibold mb-4 ${textPrimary}`}>📋 Account Details</h3>
                  {[
                    { label: "Wallet Address", value: account },
                    { label: "Contract", value: CONTRACT_ADDRESS },
                    { label: "Network", value: "Localhost 8545 (Chain ID: 31337)" },
                    { label: "Role", value: role === "patient" ? "Patient 🙋" : "Doctor 👨‍⚕️" },
                    { label: "Status", value: isRegistered ? "Registered ✅" : "Not Registered ⚠️" },
                    { label: "Emergency", value: emergencyActive ? "🚨 Active" : "✅ Normal" },
                  ].map(({ label, value }) => (
                    <div key={label} className={`flex justify-between items-center py-3 border-b ${d ? "border-gray-600" : "border-gray-200"} last:border-0`}>
                      <span className={`text-sm ${textSecondary}`}>{label}</span>
                      <span className={`text-xs font-mono text-right max-w-xs truncate ${textPrimary}`}>{value}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => { navigator.clipboard.writeText(account); setStatus("success:Address copied!"); }}
                  className={`w-full border rounded-xl py-3 font-medium text-sm transition-all mb-3 ${d ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                  📋 Copy My Address
                </button>
                <button onClick={exportPDF} disabled={records.length === 0}
                  className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-50">
                  📄 Export Records as PDF
                </button>
                {records.length === 0 && <p className={`text-xs text-center mt-2 ${textMuted}`}>Load records first</p>}
              </div>
            )}

            {/* Timeline */}
            {activeTab === "timeline" && (
              <div className={`rounded-2xl shadow-sm p-6 ${cardBg}`}>
                <div className="flex justify-between items-center mb-6">
                  <h2 className={`text-lg font-bold ${textPrimary}`}>⏱️ Activity Timeline</h2>
                  <button onClick={buildTimeline} disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50">
                    🔄 Load
                  </button>
                </div>
                {timeline.length === 0
                  ? <div className={`text-center py-12 ${textMuted}`}><p className="text-4xl mb-3">⏱️</p><p>Click Load.</p></div>
                  : <div className="relative">
                      <div className={`absolute left-6 top-0 bottom-0 w-0.5 ${d ? "bg-gray-600" : "bg-gray-200"}`}></div>
                      {timeline.map((event, i) => (
                        <div key={i} className="relative flex gap-4 mb-6 pl-14">
                          <div className={`absolute left-4 w-4 h-4 rounded-full border-2 border-white ${dotColors[event.color]} shadow-md`} style={{ top: "4px" }}></div>
                          <div className={`flex-1 border rounded-xl p-4 ${timelineColors[event.color]}`}>
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xl">{event.icon}</span>
                                <span className="font-semibold text-sm">{event.title}</span>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded-full ${d ? "bg-gray-700 text-gray-300" : "bg-white text-gray-500"}`}>Block #{event.time}</span>
                            </div>
                            <p className="text-xs mb-2">{event.desc}</p>
                            <button onClick={() => { navigator.clipboard.writeText(event.tx); setStatus("success:Tx hash copied!"); }}
                              className="text-xs underline opacity-70">📋 {event.tx.slice(0, 20)}...</button>
                          </div>
                        </div>
                      ))}
                    </div>
                }
                {timeline.length > 0 && (
                  <div className={`mt-4 rounded-xl p-4 ${d ? "bg-gray-700" : "bg-gray-50"}`}>
                    <p className={`text-sm font-semibold mb-3 ${textPrimary}`}>📊 Summary</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: "Registered", count: timeline.filter(e => e.type === "registered").length, color: "text-blue-500" },
                        { label: "Records", count: timeline.filter(e => e.type === "record").length, color: "text-green-500" },
                        { label: "Authorized", count: timeline.filter(e => e.type === "authorized").length, color: "text-purple-500" },
                        { label: "Revoked", count: timeline.filter(e => e.type === "revoked").length, color: "text-red-500" },
                      ].map(({ label, count, color }) => (
                        <div key={label} className="text-center">
                          <p className={`text-xl font-bold ${color}`}>{count}</p>
                          <p className={`text-xs ${textSecondary}`}>{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className={`text-center mt-8 text-xs ${textMuted}`}>
          <p>🔒 Secured by Ethereum Blockchain • Built for SIH 2026</p>
        </div>
      </div>
    </div>
  );
}

export default App;