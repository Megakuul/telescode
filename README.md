# telescode 🔭

![icon](/src/assets/favicon.png)

Like telescope but for vscode and in simple.

## Setup

Ensure you have `rg` and `fd` installed on your system and call the vscode `telescope.open` command.

By default the command is configured to `ctrl+shift+f` but you can also add a custom binding (e.g. for vim):

```json
{
  "vim.normalModeKeyBindingsNonRecursive": [
    {
      "before": ["<leader>", "f"],
      "commands": ["telescode.open"]
    }
  ]
}
```

## Modes

You can start typing one of the listed prefixes in the search bar to use custom modes:

| Prefix  | Mode     | Behavior                                            |
| ------- | -------- | --------------------------------------------------- |
| default | `match`  | workspace local full-text-search with exact match   |
| `r:`    | `regex`  | workspace local full-text-search with regex support |
| `f:`    | `file`   | workspace local file search with fuzzy match        |
| `g:`    | `global` | filesystem root file search with fuzzy match        |

## Support

Works on linux with preinstalled ripgrep and fd. I did not test any other setup.
