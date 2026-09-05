// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract HealthRecords {

    struct Record {
        uint256 id;
        string diagnosis;
        string treatment;
        string doctorName;
        uint256 timestamp;
        address doctor;
    }

    struct Patient {
        string name;
        bool registered;
        uint256[] recordIds;
        mapping(address => bool) authorizedDoctors;
    }

    mapping(address => Patient) private patients;
    mapping(uint256 => Record) private records;
    uint256 private recordCounter;
    address[] private patientList;          // ← ADD THIS LINE

    event PatientRegistered(address indexed patient, string name);
    event RecordAdded(address indexed patient, uint256 recordId);
    event DoctorAuthorized(address indexed patient, address indexed doctor);
    event DoctorRevoked(address indexed patient, address indexed doctor);

    modifier onlyRegistered() {
        require(patients[msg.sender].registered, "Patient not registered");
        _;
    }

    modifier onlyAuthorized(address _patient) {
        require(
            msg.sender == _patient ||
            patients[_patient].authorizedDoctors[msg.sender],
            "Not authorized"
        );
        _;
    }

    function registerPatient(string memory _name) public {
        require(!patients[msg.sender].registered, "Already registered");
        patients[msg.sender].name = _name;
        patients[msg.sender].registered = true;
        patientList.push(msg.sender);       // ← ADD THIS LINE
        emit PatientRegistered(msg.sender, _name);
    }

    function authorizeDoctor(address _doctor) public onlyRegistered {
        patients[msg.sender].authorizedDoctors[_doctor] = true;
        emit DoctorAuthorized(msg.sender, _doctor);
    }

    function revokeDoctor(address _doctor) public onlyRegistered {
        patients[msg.sender].authorizedDoctors[_doctor] = false;
        emit DoctorRevoked(msg.sender, _doctor);
    }

    function addRecord(
        address _patient,
        string memory _diagnosis,
        string memory _treatment,
        string memory _doctorName
    ) public onlyAuthorized(_patient) {
        require(patients[_patient].registered, "Patient not registered");
        recordCounter++;
        records[recordCounter] = Record({
            id: recordCounter,
            diagnosis: _diagnosis,
            treatment: _treatment,
            doctorName: _doctorName,
            timestamp: block.timestamp,
            doctor: msg.sender
        });
        patients[_patient].recordIds.push(recordCounter);
        emit RecordAdded(_patient, recordCounter);
    }

    function getRecords(address _patient)
        public view
        onlyAuthorized(_patient)
        returns (Record[] memory)
    {
        uint256[] memory ids = patients[_patient].recordIds;
        Record[] memory result = new Record[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = records[ids[i]];
        }
        return result;
    }

    function getPatientName(address _patient)
        public view
        onlyAuthorized(_patient)
        returns (string memory)
    {
        return patients[_patient].name;
    }

    function isRegistered(address _patient) public view returns (bool) {
        return patients[_patient].registered;
    }

    function isAuthorized(address _patient, address _doctor)
        public view returns (bool)
    {
        return patients[_patient].authorizedDoctors[_doctor];
    }

    // ← ADD THESE 2 NEW FUNCTIONS AT THE END
    function getAllPatients() public view returns (address[] memory) {
        return patientList;
    }

    function getPatientCount() public view returns (uint256) {
        return patientList.length;
    }
}