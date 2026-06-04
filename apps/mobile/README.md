# Helferchen Mobile App

## Tech Stack
- **Framework:** Compose Multiplatform (Kotlin)
- **State Management:** Voyager or Decompose
- **Networking:** Ktor
- **Dependency Injection:** Koin

## Structure
- `composeApp`: Shared UI and logic
- `iosApp`: iOS specific entry point
- `androidApp`: Android specific entry point

## Getting Started
(Requires JDK 17+, Android Studio, and Kotlin Multiplatform plugin)

1. Open the project in Android Studio.
2. Run `./gradlew :composeApp:run` for desktop or use the run configurations for Android/iOS.
