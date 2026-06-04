package com.helferchen.app.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class User(
    val id: String,
    val username: String,
    val role: String,
    @SerialName("full_name") val fullName: String,
    val email: String? = null
)

@Serializable
data class Customer(
    val id: String,
    @SerialName("first_name") val firstName: String,
    @SerialName("last_name") val lastName: String,
    val address: String,
    @SerialName("phone_number") val phoneNumber: String? = null,
    val notes: String? = null
) {
    val fullName get() = "$firstName $lastName"
}

@Serializable
data class Assignment(
    val id: String,
    val title: String,
    val description: String = "",
    @SerialName("scheduled_at") val scheduledAt: String = "",
    val status: String = "pending",
    val customer: Customer? = null
)

@Serializable
data class Timelog(
    val id: String,
    @SerialName("assignment_id") val assignmentId: String,
    @SerialName("start_time") val startTime: String,
    @SerialName("end_time") val endTime: String? = null,
    @SerialName("is_signed") val isSigned: Boolean = false
)

@Serializable
data class Report(
    val id: String,
    @SerialName("assignment_id") val assignmentId: String,
    @SerialName("timelog_id") val timelogId: String,
    val notes: String = "",
    @SerialName("signature_id") val signatureId: String? = null,
    @SerialName("pdf_generated") val pdfGenerated: Boolean = false,
    @SerialName("email_sent") val emailSent: Boolean = false,
    val timelog: Timelog? = null,
    val assignment: Assignment? = null,
    val customer: Customer? = null
)

@Serializable
data class Signature(
    val id: String,
    @SerialName("report_id") val reportId: String,
    @SerialName("signer_name") val signerName: String,
    @SerialName("signed_at") val signedAt: String
)

@Serializable
data class LoginResponse(
    val token: String,
    val user: User
)

// Request bodies
@Serializable
data class LoginRequest(val username: String, val password: String)

@Serializable
data class StartTimerRequest(@SerialName("assignment_id") val assignmentId: String)

@Serializable
data class StopTimerRequest(@SerialName("timelog_id") val timelogId: String)

@Serializable
data class CreateReportRequest(
    @SerialName("assignment_id") val assignmentId: String,
    @SerialName("timelog_id") val timelogId: String,
    val notes: String
)

@Serializable
data class SubmitSignatureRequest(
    @SerialName("report_id") val reportId: String,
    @SerialName("image_data") val imageData: String,
    @SerialName("signer_name") val signerName: String
)

@Serializable
data class SendEmailRequest(val to: String)
