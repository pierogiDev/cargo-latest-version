# Cargo Latest Version

A Visual Studio Code extension that displays the latest version of crates next to their specified versions in `Cargo.toml` files.

## Features

- Automatically detects and displays the latest version of crates from [crates.io](https://crates.io)
- Shows version information in two formats:
  - `( = latest: x.y.z )` when the current version matches the latest version
  - `( < latest: x.y.z )` when a newer version is available
- Updates automatically when you add or modify dependencies
- Works with both direct dependencies and dev-dependencies

## Installation

1. Download the latest `.vsix` file from the releases
2. Open VS Code
3. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)
4. Type "Install from VSIX" and select it
5. Choose the downloaded `.vsix` file

Alternatively, you can install it from the command line:
```bash
code --install-extension cargo-latest-version-0.6.0.vsix
```

## Usage

1. Open a Rust project containing a `Cargo.toml` file
2. The extension will automatically display the latest versions next to your dependencies
3. The version information updates automatically when you:
   - Open a `Cargo.toml` file
   - Add new dependencies
   - Modify existing dependencies

Example:
```toml
[dependencies]
serde = "1.0.0" ( < latest: 1.0.192 )
tokio = "1.35.0" ( = latest: 1.35.0 )
```

## Requirements

- Visual Studio Code 1.85.0 or higher
- An internet connection to fetch latest versions from crates.io

## Extension Settings

This extension contributes no additional settings.

## Known Issues

None at this time.

## Release Notes

### 0.6.0

- Improved version display formatting
- Added spaces around operators for better readability
- Optimized extension package size

### 0.5.0

- Initial release
- Added automatic version checking
- Implemented version display decorations

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This extension is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
