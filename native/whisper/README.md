# Whisper Binary Setup

This folder should contain the pre-compiled whisper.cpp binaries for local transcription.

## Required Structure

```
native/whisper/bin/
├── win32-x64/
│   └── whisper.exe
├── darwin-x64/
│   └── whisper-cli
├── darwin-arm64/
│   └── whisper-cli
└── linux-x64/
    └── whisper-cli
```

## Getting the Binary

### Option 1: Download Pre-built (Recommended)

Download pre-built binaries from:

- https://github.com/ggerganov/whisper.cpp/releases

For Windows (MSVC):

1. Download `whisper-bin-x64.zip` from releases
2. Extract `main.exe` and rename to `whisper.exe`
3. Place in `native/whisper/bin/win32-x64/`

### Option 2: Build from Source

1. Clone whisper.cpp:

   ```bash
   git clone https://github.com/ggerganov/whisper.cpp
   cd whisper.cpp
   ```

2. Build (Windows with MSVC):

   ```bash
   cmake -B build -DCMAKE_BUILD_TYPE=Release
   cmake --build build --config Release
   ```

   The binary will be at `build/bin/Release/main.exe`

3. Copy and rename:
   ```bash
   copy build\bin\Release\main.exe ..\native\whisper\bin\win32-x64\whisper.exe
   ```

## Notes

- The binary is NOT included in the repository (too large, ~10MB+)
- Users need to download/compile it themselves or it will be included in packaged releases
- Models are downloaded separately from HuggingFace at runtime
