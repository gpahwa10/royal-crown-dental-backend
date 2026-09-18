export type OdontogramErrorCode =
    | "ODONTOGRAM_NOT_FOUND"
    | "ODONTOGRAM_CONSULTATION_NOT_FOUND"
    | "ODONTOGRAM_PATIENT_NOT_FOUND"
    | "ODONTOGRAM_NOT_EDITABLE"
    | "ODONTOGRAM_VERSION_CONFLICT"
    | "ODONTOGRAM_UNAUTHORIZED"
    | "ODONTOGRAM_INVALID_STATE";

/** Per-tooth chart entry. Clients may store condition/procedure fields; notes is optional. */
export type OdontogramToothEntry = Record<string, unknown> & {
    notes?: string | null;
};

export interface PatientOdontogramData {
    id?: string;
    patientId: string;
    clinicId?: string;
    statusChart: Record<string, unknown>;
    planChart: Record<string, unknown> | null;
    version: number;
    createdAt?: Date;
    updatedAt: Date;
}

export interface ConsultationOdontogramData {
    id?: string;
    consultationId: string;
    patientId: string;
    clinicId?: string;
    statusChart: Record<string, unknown>;
    planChart: Record<string, unknown> | null;
    chartVersion: number;
    readOnly?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface UpdateConsultationOdontogramInput {
    statusChart: Record<string, unknown>;
    planChart?: Record<string, unknown> | null;
    version: number;
}

export interface UpdateToothNotesInput {
    toothNumber: string;
    notes: string | null;
    version: number;
}

export interface OdontogramChangeRecord {
    toothNumber: string | null;
    changeType: string;
    previousState: Record<string, unknown> | null;
    newState: Record<string, unknown>;
}
