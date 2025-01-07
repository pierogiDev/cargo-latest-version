# Cargo Latest Version

Automatically displays the latest version of crates next to their specified versions in your `Cargo.toml` files. Stay up-to-date with your Rust dependencies at a glance!

![Version Display Example](https://raw.githubusercontent.com/pierogiDev/cargo-latest-version/main/images/version-display.png)

## Features

✨ **Real-time Version Information**
- See the latest versions from crates.io right in your editor
- Automatic updates when you add or modify dependencies
- Clear visual indicators for up-to-date and outdated packages
- Efficient caching system for faster version lookups

📌 **Smart Version Display**
- `( = latest: x.y.z )` - Your dependency is up to date
- `( < latest: x.y.z )` - A newer version is available

🔄 **Automatic Updates**
- Version information appears instantly when you:
  - Open a `Cargo.toml` file
  - Add new dependencies
  - Modify existing dependencies

## Example

Your `Cargo.toml` will show version information like this:

```toml
[dependencies]
serde = "1.0.0" ( < latest: 1.0.192 )
tokio = "1.35.0" ( = latest: 1.35.0 )
```

## Requirements

- Visual Studio Code 1.85.0 or higher
  - Also works with VS Code compatible editors:
    - [VSCodium](https://vscodium.com/)
    - [Cursor](https://cursor.sh/)
    - [Windsurf](https://codeium.com/windsurf/)
    - Other VS Code based editors
- Internet connection (to fetch latest versions from crates.io)

## Installation

1. Download the `.vsix` file from the [GitHub repository](https://github.com/pierogiDev/cargo-latest-version)
2. In VS Code:
   - Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)
   - Type "Install from VSIX" and select it
   - Choose the downloaded `.vsix` file

Or via command line:
```bash
code --install-extension cargo-latest-version-0.6.0.vsix
```

## Contributing

Found a bug or have a suggestion? Please feel free to:
1. [Open an issue](https://github.com/pierogiDev/cargo-latest-version/issues)
2. Submit a pull request

## License

This extension is licensed under the [MIT License](LICENSE).
