package com.helferchen.app.api

import com.helferchen.app.model.*
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.json.Json

class ApiClient(private val baseUrl: String = "https://helferchen.info") {
    var token: String? = null

    private val client = HttpClient {
        install(ContentNegotiation) {
            json(Json { ignoreUnknownKeys = true })
        }
    }

    private fun HttpRequestBuilder.auth() {
        token?.let { headers.append(HttpHeaders.Authorization, "Bearer $it") }
    }

    suspend fun checkUpdate(): AppVersionInfo? {
        return try {
            client.get("https://helferchen.info/version.json").body()
        } catch (e: Exception) {
            null
        }
    }

    suspend fun login(username: String, password: String): LoginResponse {
        val resp = client.post("$baseUrl/api/auth/login") {
            contentType(ContentType.Application.Json)
            setBody(LoginRequest(username, password))
        }
        val loginResp = resp.body<LoginResponse>()
        token = loginResp.token
        return loginResp
    }

    suspend fun getMyAssignments(): List<Assignment> =
        client.get("$baseUrl/api/assignments/my") { auth() }.body()

    suspend fun startTimer(assignmentId: String): Timelog =
        client.post("$baseUrl/api/timelogs/start") {
            auth()
            contentType(ContentType.Application.Json)
            setBody(StartTimerRequest(assignmentId))
        }.body()

    suspend fun stopTimer(timelogId: String): Timelog =
        client.post("$baseUrl/api/timelogs/stop") {
            auth()
            contentType(ContentType.Application.Json)
            setBody(StopTimerRequest(timelogId))
        }.body()

    suspend fun createReport(assignmentId: String, timelogId: String, notes: String): Report =
        client.post("$baseUrl/api/reports") {
            auth()
            contentType(ContentType.Application.Json)
            setBody(CreateReportRequest(assignmentId, timelogId, notes))
        }.body()

    suspend fun submitSignature(reportId: String, imageData: String, signerName: String): Signature =
        client.post("$baseUrl/api/signatures") {
            auth()
            contentType(ContentType.Application.Json)
            setBody(SubmitSignatureRequest(reportId, imageData, signerName))
        }.body()

    suspend fun sendPdfEmail(reportId: String, to: String) {
        client.post("$baseUrl/api/pdf/$reportId/email") {
            auth()
            contentType(ContentType.Application.Json)
            setBody(SendEmailRequest(to))
        }
    }

    fun getPdfUrl(reportId: String): String = "$baseUrl/api/pdf/$reportId?token=${token ?: ""}"

    suspend fun getMapAssignments(): MapAssignmentsResponse =
        client.get("$baseUrl/api/assignments/map") { auth() }.body()
}

@kotlinx.serialization.Serializable
data class MapAssignmentsResponse(
    val mine: List<com.helferchen.app.model.Assignment>,
    val unassigned: List<com.helferchen.app.model.Assignment>
)
