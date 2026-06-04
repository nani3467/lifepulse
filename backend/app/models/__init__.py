from app.models.user import User, DoctorRegistrationRequest
from app.models.patient import Patient, MedicalHistory, Admission, DiseaseRecord, PatientReport, PatientVitalsLog, HealthScan
from app.models.appointment import Department, DoctorProfile, TimeSlot, Appointment, QueueEntry, AppointmentNotification
from app.models.prediction import PredictionRecord
from app.models.emergency import EmergencyAlert
from app.models.bloodbank import BloodDonor, BloodInventory, BloodRequest, DonationHistory
from app.models.pharmacy import Medicine, Prescription, PrescriptionItem, Supplier, MedicineAlert, DoctorVerification
from app.models.notification import Notification

__all__ = [
    'User', 'DoctorRegistrationRequest', 'Patient', 'MedicalHistory', 'Admission', 'DiseaseRecord', 'PatientReport', 'PatientVitalsLog', 'HealthScan',
    'Department', 'DoctorProfile', 'TimeSlot', 'Appointment', 'QueueEntry', 'AppointmentNotification',
    'PredictionRecord', 'EmergencyAlert',
    'BloodDonor', 'BloodInventory', 'BloodRequest', 'DonationHistory',
    'Medicine', 'Prescription', 'PrescriptionItem', 'Supplier', 'MedicineAlert', 'DoctorVerification',
    'Notification'
]

