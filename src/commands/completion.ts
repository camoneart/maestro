import { Command } from 'commander'
import chalk from 'chalk'

const BASH_COMPLETION = `#!/bin/bash
# shadow-clone-jutsu bash completion

_scj_completions() {
    local cur prev opts base
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD - 1]}"
    
    # コマンド一覧
    local commands="create list delete shell exec attach github config mcp completion tmux where"
    local aliases="ls rm sh e a gh t w"
    
    # 最初の引数の場合
    if [[ ${COMP_CWORD} -eq 1 ]]; then
        COMPREPLY=( $(compgen -W "${commands} ${aliases}" -- ${cur}) )
        return 0
    fi
    
    # サブコマンドごとの補完
    case "${COMP_WORDS[1]}" in
        create)
            # ブランチ名の補完（既存のローカルブランチを提案）
            if [[ ${COMP_CWORD} -eq 2 ]]; then
                local branches=$(git branch 2>/dev/null | grep -v "^*" | sed 's/^ *//')
                COMPREPLY=( $(compgen -W "${branches}" -- ${cur}) )
            fi
            ;;
        shell|sh|exec|e|delete|rm)
            # worktreeのブランチ名を補完
            if [[ ${COMP_CWORD} -eq 2 ]]; then
                local worktrees=$(git worktree list --porcelain 2>/dev/null | grep "^branch" | sed 's/^branch refs\\/heads\\///')
                COMPREPLY=( $(compgen -W "${worktrees}" -- ${cur}) )
            fi
            ;;
        github|gh)
            if [[ ${COMP_CWORD} -eq 2 ]]; then
                COMPREPLY=( $(compgen -W "checkout pr issue" -- ${cur}) )
            fi
            ;;
        config)
            if [[ ${COMP_CWORD} -eq 2 ]]; then
                COMPREPLY=( $(compgen -W "init show path" -- ${cur}) )
            fi
            ;;
        mcp)
            if [[ ${COMP_CWORD} -eq 2 ]]; then
                COMPREPLY=( $(compgen -W "serve" -- ${cur}) )
            fi
            ;;
        completion)
            if [[ ${COMP_CWORD} -eq 2 ]]; then
                COMPREPLY=( $(compgen -W "bash zsh fish" -- ${cur}) )
            fi
            ;;
        tmux|t)
            # worktreeのブランチ名を補完
            if [[ ${COMP_CWORD} -eq 2 ]]; then
                local worktrees=$(git worktree list --porcelain 2>/dev/null | grep "^branch" | sed 's/^branch refs\\/heads\\///')
                COMPREPLY=( $(compgen -W "${worktrees}" -- ${cur}) )
            fi
            ;;
        where|w)
            # worktreeのブランチ名を補完
            if [[ ${COMP_CWORD} -eq 2 ]]; then
                local worktrees=$(git worktree list --porcelain 2>/dev/null | grep "^branch" | sed 's/^branch refs\\/heads\\///')
                COMPREPLY=( $(compgen -W "${worktrees}" -- ${cur}) )
            fi
            ;;
    esac
    
    # オプションの補完
    if [[ "\${cur}" == -* ]]; then
        case "${COMP_WORDS[1]}" in
            create)
                opts="--base --open --setup --help"
                ;;
            delete|rm)
                opts="--force --remove-remote --help"
                ;;
            exec|e)
                opts="--silent --all --help"
                ;;
            github|gh)
                opts="--open --setup --help"
                ;;
            tmux|t)
                opts="--new-window --split-pane --vertical --help"
                ;;
            where|w)
                opts="--fzf --current --help"
                ;;
            *)
                opts="--help"
                ;;
        esac
        COMPREPLY=( $(compgen -W "${opts}" -- ${cur}) )
    fi
}

complete -F _scj_completions scj
complete -F _scj_completions shadow-clone-jutsu
`

const ZSH_COMPLETION = `#compdef scj shadow-clone-jutsu
# shadow-clone-jutsu zsh completion

_scj() {
    local -a commands
    commands=(
        'create:新しい影分身（worktree）を作り出す'
        'list:影分身（worktree）の一覧を表示'
        'delete:影分身（worktree）を削除'
        'shell:影分身のシェルに入る'
        'exec:影分身でコマンドを実行'
        'attach:既存のブランチから影分身を作り出す'
        'github:GitHub PR/Issueから影分身を作り出す'
        'config:設定を管理'
        'mcp:MCPサーバーを起動'
        'completion:シェル補完スクリプトを生成'
        'tmux:tmux/fzfで影分身を選択して開く'
        'where:影分身のパスを表示'
    )
    
    local -a aliases
    aliases=(
        'ls:list'
        'rm:delete'
        'sh:shell'
        'e:exec'
        'a:attach'
        'gh:github'
        't:tmux'
        'w:where'
    )
    
    if (( CURRENT == 2 )); then
        _describe -t commands 'scj commands' commands
        _describe -t aliases 'scj aliases' aliases
        return
    fi
    
    case "\${words[2]}" in
        create)
            if (( CURRENT == 3 )); then
                _git_branch_names
            fi
            _arguments \
                '-b[ベースブランチ]:branch:_git_branch_names' \
                '--base[ベースブランチ]:branch:_git_branch_names' \
                '-o[VSCode/Cursorで開く]' \
                '--open[VSCode/Cursorで開く]' \
                '-s[環境セットアップを実行]' \
                '--setup[環境セットアップを実行]'
            ;;
        shell|sh|exec|e|delete|rm)
            if (( CURRENT == 3 )); then
                local worktrees
                worktrees=($(git worktree list --porcelain 2>/dev/null | grep "^branch" | sed 's/^branch refs\\/heads\\//' | tr '\\n' ' '))
                _values 'worktrees' $worktrees
            fi
            ;;
        github|gh)
            if (( CURRENT == 3 )); then
                _values 'type' 'checkout' 'pr' 'issue'
            fi
            _arguments \
                '-o[VSCode/Cursorで開く]' \
                '--open[VSCode/Cursorで開く]' \
                '-s[環境セットアップを実行]' \
                '--setup[環境セットアップを実行]'
            ;;
        config)
            if (( CURRENT == 3 )); then
                _values 'action' 'init' 'show' 'path'
            fi
            _arguments \
                '-g[グローバル設定を対象にする]' \
                '--global[グローバル設定を対象にする]'
            ;;
        mcp)
            if (( CURRENT == 3 )); then
                _values 'subcommand' 'serve'
            fi
            ;;
        completion)
            if (( CURRENT == 3 )); then
                _values 'shell' 'bash' 'zsh' 'fish'
            fi
            ;;
        tmux|t)
            _arguments \
                '-n[新しいウィンドウで開く]' \
                '--new-window[新しいウィンドウで開く]' \
                '-p[現在のペインを分割して開く]' \
                '--split-pane[現在のペインを分割して開く]' \
                '-v[垂直分割]' \
                '--vertical[垂直分割]'
            ;;
        where|w)
            if (( CURRENT == 3 )); then
                local worktrees
                worktrees=(\\$(git worktree list --porcelain 2>/dev/null | grep "^branch" | sed 's/^branch refs\\/heads\\//' | tr '\\n' ' '))
                _values 'worktrees' \\$worktrees
            fi
            _arguments \
                '--fzf[fzfで選択]' \
                '--current[現在のworktreeのパスを表示]'
            ;;
    esac
}

_scj "$@"
`

const FISH_COMPLETION = `# shadow-clone-jutsu fish completion

# コマンドの補完を無効化
complete -c scj -e
complete -c shadow-clone-jutsu -e

# メインコマンド
complete -c scj -n "__fish_use_subcommand" -a "create" -d "新しい影分身（worktree）を作り出す"
complete -c scj -n "__fish_use_subcommand" -a "list ls" -d "影分身（worktree）の一覧を表示"
complete -c scj -n "__fish_use_subcommand" -a "delete rm" -d "影分身（worktree）を削除"
complete -c scj -n "__fish_use_subcommand" -a "shell sh" -d "影分身のシェルに入る"
complete -c scj -n "__fish_use_subcommand" -a "exec e" -d "影分身でコマンドを実行"
complete -c scj -n "__fish_use_subcommand" -a "attach a" -d "既存のブランチから影分身を作り出す"
complete -c scj -n "__fish_use_subcommand" -a "github gh" -d "GitHub PR/Issueから影分身を作り出す"
complete -c scj -n "__fish_use_subcommand" -a "config" -d "設定を管理"
complete -c scj -n "__fish_use_subcommand" -a "mcp" -d "MCPサーバーを起動"
complete -c scj -n "__fish_use_subcommand" -a "completion" -d "シェル補完スクリプトを生成"
complete -c scj -n "__fish_use_subcommand" -a "tmux t" -d "tmux/fzfで影分身を選択して開く"
complete -c scj -n "__fish_use_subcommand" -a "where w" -d "影分身のパスを表示"

# create コマンドのオプション
complete -c scj -n "__fish_seen_subcommand_from create" -s b -l base -d "ベースブランチ"
complete -c scj -n "__fish_seen_subcommand_from create" -s o -l open -d "VSCode/Cursorで開く"
complete -c scj -n "__fish_seen_subcommand_from create" -s s -l setup -d "環境セットアップを実行"

# delete コマンドのオプション
complete -c scj -n "__fish_seen_subcommand_from delete rm" -s f -l force -d "強制削除"
complete -c scj -n "__fish_seen_subcommand_from delete rm" -s r -l remove-remote -d "リモートブランチも削除"

# exec コマンドのオプション
complete -c scj -n "__fish_seen_subcommand_from exec e" -s s -l silent -d "出力を抑制"
complete -c scj -n "__fish_seen_subcommand_from exec e" -s a -l all -d "すべての影分身で実行"

# github コマンドのオプション
complete -c scj -n "__fish_seen_subcommand_from github gh" -s o -l open -d "VSCode/Cursorで開く"
complete -c scj -n "__fish_seen_subcommand_from github gh" -s s -l setup -d "環境セットアップを実行"

# config コマンドのオプション
complete -c scj -n "__fish_seen_subcommand_from config" -s g -l global -d "グローバル設定を対象にする"

# tmux コマンドのオプション
complete -c scj -n "__fish_seen_subcommand_from tmux t" -s n -l new-window -d "新しいウィンドウで開く"
complete -c scj -n "__fish_seen_subcommand_from tmux t" -s p -l split-pane -d "現在のペインを分割して開く"
complete -c scj -n "__fish_seen_subcommand_from tmux t" -s v -l vertical -d "垂直分割"

# where コマンドのオプション
complete -c scj -n "__fish_seen_subcommand_from where w" -l fzf -d "fzfで選択"
complete -c scj -n "__fish_seen_subcommand_from where w" -l current -d "現在のworktreeのパスを表示"

# サブコマンドの引数補完
complete -c scj -n "__fish_seen_subcommand_from config; and __fish_is_nth_token 3" -a "init show path"
complete -c scj -n "__fish_seen_subcommand_from mcp; and __fish_is_nth_token 3" -a "serve"
complete -c scj -n "__fish_seen_subcommand_from completion; and __fish_is_nth_token 3" -a "bash zsh fish"
complete -c scj -n "__fish_seen_subcommand_from github gh; and __fish_is_nth_token 3" -a "checkout pr issue"

# worktreeブランチ名の補完（動的）
complete -c scj -n "__fish_seen_subcommand_from shell sh exec e delete rm where w" -a "(git worktree list --porcelain 2>/dev/null | grep '^branch' | sed 's/^branch refs\\/heads\\///')"

# shadow-clone-jutsuにも同じ補完を適用
complete -c shadow-clone-jutsu -w scj
`

export const completionCommand = new Command('completion')
  .description('シェル補完スクリプトを生成')
  .argument('[shell]', 'シェルの種類 (bash, zsh, fish)')
  .action(async (shell?: string) => {
    if (!shell) {
      console.log(chalk.bold('🥷 shadow-clone-jutsu シェル補完\n'))
      console.log('使い方:')
      console.log('  scj completion <shell>  # 補完スクリプトを表示')
      console.log('\nサポートされているシェル:')
      console.log('  - bash')
      console.log('  - zsh')
      console.log('  - fish')
      console.log('\n' + chalk.gray('セットアップ方法:'))
      console.log(chalk.gray('  scj completion bash >> ~/.bashrc'))
      console.log(chalk.gray('  scj completion zsh > ~/.zsh/completions/_scj'))
      console.log(chalk.gray('  scj completion fish > ~/.config/fish/completions/scj.fish'))
      return
    }

    switch (shell.toLowerCase()) {
      case 'bash':
        console.log(BASH_COMPLETION)
        console.error(chalk.gray('\n# セットアップ方法:'))
        console.error(chalk.gray('# 1. 以下を実行:'))
        console.error(chalk.cyan('  scj completion bash >> ~/.bashrc'))
        console.error(chalk.gray('# 2. シェルを再起動するか:'))
        console.error(chalk.cyan('  source ~/.bashrc'))
        break

      case 'zsh':
        console.log(ZSH_COMPLETION)
        console.error(chalk.gray('\n# セットアップ方法:'))
        console.error(chalk.gray('# 1. 補完ディレクトリを作成（まだない場合）:'))
        console.error(chalk.cyan('  mkdir -p ~/.zsh/completions'))
        console.error(chalk.gray('# 2. 補完スクリプトを保存:'))
        console.error(chalk.cyan('  scj completion zsh > ~/.zsh/completions/_scj'))
        console.error(chalk.gray('# 3. ~/.zshrcに以下を追加（まだない場合）:'))
        console.error(chalk.cyan('  fpath=(~/.zsh/completions $fpath)'))
        console.error(chalk.cyan('  autoload -U compinit && compinit'))
        console.error(chalk.gray('# 4. シェルを再起動'))
        break

      case 'fish':
        console.log(FISH_COMPLETION)
        console.error(chalk.gray('\n# セットアップ方法:'))
        console.error(chalk.gray('# 1. 補完ディレクトリを作成（まだない場合）:'))
        console.error(chalk.cyan('  mkdir -p ~/.config/fish/completions'))
        console.error(chalk.gray('# 2. 補完スクリプトを保存:'))
        console.error(chalk.cyan('  scj completion fish > ~/.config/fish/completions/scj.fish'))
        console.error(chalk.gray('# 3. 新しいシェルセッションで自動的に有効になります'))
        break

      default:
        console.error(chalk.red(`エラー: サポートされていないシェル '${shell}'`))
        console.error(chalk.gray('サポートされているシェル: bash, zsh, fish'))
        process.exit(1)
    }
  })
