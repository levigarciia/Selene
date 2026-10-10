export const scriptComputador = `
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, Accessibility
Add-Type -ReferencedAssemblies UIAutomationClient,UIAutomationTypes,WindowsBase,Accessibility -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Text;
using System.Runtime.InteropServices;
using System.Windows.Automation;
public static class ComputadorSelene {
    [DllImport("oleacc.dll")] public static extern int AccessibleObjectFromWindow(IntPtr janela, uint identificador,
        ref Guid interfaceId, [MarshalAs(UnmanagedType.Interface)] out object objeto);
    public static void SolicitarAcessibilidade(IntPtr janela) {
        List<IntPtr> janelas = new List<IntPtr>(Filhas(janela)); janelas.Add(janela);
        foreach (IntPtr alvo in janelas) {
            Guid interfaceId = new Guid("618736E0-3C3D-11CF-810C-00AA00389B71"); object objeto;
            if (AccessibleObjectFromWindow(alvo, 0xFFFFFFFC, ref interfaceId, out objeto) >= 0 && objeto != null) {
                try { int quantidade = ((Accessibility.IAccessible)objeto).accChildCount; }
                catch (COMException) {}
                finally { if (Marshal.IsComObject(objeto)) Marshal.ReleaseComObject(objeto); }
            }
        }
    }
    public delegate bool Enumerar(IntPtr janela, IntPtr dado);
    [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr janela, Enumerar callback, IntPtr dado);
    public static IntPtr[] Filhas(IntPtr janela) {
        List<IntPtr> filhas = new List<IntPtr>();
        EnumChildWindows(janela, delegate(IntPtr filha, IntPtr dado) { filhas.Add(filha); return true; }, IntPtr.Zero);
        return filhas.ToArray();
    }
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr janela,
        StringBuilder nome, int tamanho);
    [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr janela, int indice);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessageTimeout(IntPtr janela,
        uint mensagem, UIntPtr parametro, string texto, uint flags, uint tempo, out UIntPtr resultado);
    public static string Classe(int janela) {
        StringBuilder nome = new StringBuilder(256); GetClassName(new IntPtr(janela), nome, 256); return nome.ToString();
    }
    public static bool CampoNativo(int janela) {
        string classe = Classe(janela).ToUpperInvariant();
        return classe == "EDIT" || classe.Contains(".EDIT.");
    }
    public static bool SenhaNativa(int janela) {
        return CampoNativo(janela) && (GetWindowLong(new IntPtr(janela), -16) & 32) != 0;
    }
    public static bool ClicarNativo(int janela) {
        string classe = Classe(janela).ToUpperInvariant();
        if (classe != "BUTTON" && !classe.Contains(".BUTTON.")) return false;
        UIntPtr resultado;
        if (SendMessageTimeout(new IntPtr(janela), 245, UIntPtr.Zero, null, 2, 2000, out resultado) == IntPtr.Zero)
            throw new Exception("O aplicativo não respondeu ao clique.");
        return true;
    }
    public static void Preencher(int janela, string texto) {
        if (!CampoNativo(janela) || SenhaNativa(janela) || (GetWindowLong(new IntPtr(janela), -16) & 2048) != 0)
            throw new Exception("O campo nativo não permite preenchimento.");
        UIntPtr resultado;
        if (SendMessageTimeout(new IntPtr(janela), 12, UIntPtr.Zero, texto, 2, 2000, out resultado) == IntPtr.Zero)
            throw new Exception("O aplicativo não respondeu ao preenchimento.");
    }
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr janela);
    [StructLayout(LayoutKind.Sequential)] public struct Ponto { public int x, y; }
    [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(Ponto ponto);
    [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr janela, uint tipo);
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr janela, IntPtr processo);
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint origem, uint destino, bool anexar);
    public static bool Ativar(IntPtr janela) {
        if (GetForegroundWindow() == janela) return true;
        uint origem = GetCurrentThreadId();
        uint destino = GetWindowThreadProcessId(GetForegroundWindow(), IntPtr.Zero);
        bool anexado = destino != 0 && destino != origem && AttachThreadInput(origem, destino, true);
        try { SetForegroundWindow(janela); return GetForegroundWindow() == janela; }
        finally { if (anexado) AttachThreadInput(origem, destino, false); }
    }
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint tipo, uint x, uint y, int dados, UIntPtr extra);
    [DllImport("user32.dll")] public static extern uint SendInput(uint quantidade, Entrada[] entradas, int tamanho);
    [StructLayout(LayoutKind.Sequential)] public struct Entrada { public uint tipo; public Uniao valor; }
    [StructLayout(LayoutKind.Explicit)] public struct Uniao {
        [FieldOffset(0)] public Mouse mouse;
        [FieldOffset(0)] public Teclado teclado;
    }
    [StructLayout(LayoutKind.Sequential)] public struct Mouse {
        public int x, y; public uint dados, flags, tempo; public UIntPtr extra;
    }
    [StructLayout(LayoutKind.Sequential)] public struct Teclado {
        public ushort virtualKey, scan; public uint flags, tempo; public UIntPtr extra;
    }
    public static void Tecla(ushort codigo, bool soltar) {
        Entrada entrada = new Entrada(); entrada.tipo = 1;
        entrada.valor.teclado.virtualKey = codigo; entrada.valor.teclado.flags = soltar ? 2u : 0u;
        if (SendInput(1, new Entrada[] { entrada }, Marshal.SizeOf(typeof(Entrada))) != 1)
            throw new Exception("O Windows bloqueou a entrada. Verifique a elevação do aplicativo.");
    }
    public static void Pressionar(ushort codigo, bool controle) {
        try { if (controle) Tecla(17, false); Tecla(codigo, false); }
        finally { Tecla(codigo, true); if (controle) Tecla(17, true); }
    }
    public static bool Editavel(AutomationElement elemento) {
        if (elemento.Current.IsPassword || SenhaNativa(elemento.Current.NativeWindowHandle) ||
            !elemento.Current.IsEnabled) return false;
        if (elemento.Current.ControlType != ControlType.Edit &&
            elemento.Current.ControlType != ControlType.ComboBox &&
            !CampoNativo(elemento.Current.NativeWindowHandle)) return false;
        object padrao;
        if (elemento.TryGetCurrentPattern(ValuePattern.Pattern, out padrao))
            return !((ValuePattern)padrao).Current.IsReadOnly;
        if (CampoNativo(elemento.Current.NativeWindowHandle))
            return (GetWindowLong(new IntPtr(elemento.Current.NativeWindowHandle), -16) & 2048) == 0;
        return elemento.Current.ControlType == ControlType.Edit && elemento.Current.IsKeyboardFocusable;
    }
    public static void ValidarFoco(IntPtr janela, AutomationElement elemento) {
        if (GetForegroundWindow() != janela ||
            !Automation.Compare(AutomationElement.FocusedElement, elemento))
            throw new Exception("O foco mudou. Observe novamente antes de enviar entrada.");
    }
    public static void Focar(IntPtr janela, AutomationElement elemento) {
        if (!Ativar(janela)) {
            System.Windows.Point clicavel;
            if (!elemento.TryGetClickablePoint(out clicavel)) {
                System.Windows.Rect limites = elemento.Current.BoundingRectangle;
                if (limites.IsEmpty || limites.Width <= 0 || limites.Height <= 0)
                    throw new Exception("O campo não possui um ponto visível para receber foco.");
                clicavel = new System.Windows.Point(limites.X + limites.Width / 2, limites.Y + limites.Height / 2);
            }
            Ponto ponto = new Ponto(); ponto.x = (int)clicavel.X; ponto.y = (int)clicavel.Y;
            if (GetAncestor(WindowFromPoint(ponto), 2) != janela)
                throw new Exception("Outro aplicativo cobre o campo. Deixe a janela de destino visível e observe novamente.");
            if (!SetCursorPos(ponto.x, ponto.y)) throw new Exception("Não foi possível alcançar o campo.");
            mouse_event(2, 0, 0, 0, UIntPtr.Zero); mouse_event(4, 0, 0, 0, UIntPtr.Zero);
            System.Threading.Thread.Sleep(100);
            if (!Ativar(janela)) throw new Exception("Não foi possível ativar a janela para receber entrada.");
        }
        elemento.SetFocus(); System.Threading.Thread.Sleep(100);
        ValidarFoco(janela, elemento);
    }
    public static void Digitar(IntPtr janela, AutomationElement elemento, string texto) {
        if (!Editavel(elemento)) throw new Exception("Escolha uma referência com editavel=true para digitar.");
        Focar(janela, elemento);
        Pressionar(65, true);
        foreach (char caractere in texto) {
            ValidarFoco(janela, elemento);
            Entrada pressionar = new Entrada(); pressionar.tipo = 1;
            pressionar.valor.teclado.scan = caractere; pressionar.valor.teclado.flags = 4;
            Entrada soltar = pressionar; soltar.valor.teclado.flags = 6;
            if (SendInput(2, new Entrada[] { pressionar, soltar }, Marshal.SizeOf(typeof(Entrada))) != 2)
                throw new Exception("A entrada de texto foi bloqueada. Observe o campo antes de repetir.");
        }
    }
    public static string Valor(AutomationElement elemento) {
        if (!Editavel(elemento)) return null;
        object padrao;
        if (elemento.TryGetCurrentPattern(ValuePattern.Pattern, out padrao)) {
            string valor = ((ValuePattern)padrao).Current.Value;
            return valor.Substring(0, Math.Min(1000, valor.Length));
        }
        if (elemento.TryGetCurrentPattern(TextPattern.Pattern, out padrao))
            return ((TextPattern)padrao).DocumentRange.GetText(1000);
        return null;
    }
}
'@
[void][ComputadorSelene]::SetProcessDPIAware()
$referencias = @{}
$janelaAtual = $null
$observacaoAtual = ''
while ($null -ne ($linha = [Console]::ReadLine())) {
    try {
        $comando = $linha | ConvertFrom-Json
        if ($comando.acao -ne 'observar') {
            if (!$janelaAtual -or $comando.observacao -ne $observacaoAtual) {
                throw 'A observação mudou. Observe novamente.'
            }
            $elemento = $null
            if ($comando.referencia) {
                $referenciaAnterior = $referencias[$comando.referencia]
                $elemento = $referenciaAnterior.elemento
                if (!$elemento -or $elemento.Current.IsOffscreen -or !$elemento.Current.IsEnabled) {
                    throw 'O elemento está indisponível. Observe novamente.'
                }
                if ($elemento.Current.IsPassword -or
                    [ComputadorSelene]::SenhaNativa($elemento.Current.NativeWindowHandle)) {
                    throw 'Campos de senha não são permitidos.'
                }
                if ($elemento.Current.Name -ne $referenciaAnterior.nome -or
                    !$elemento.Current.BoundingRectangle.Equals($referenciaAnterior.retangulo)) {
                    throw 'O elemento mudou após a observação. Observe novamente.'
                }
            }
            switch ($comando.acao) {
                'clicar' {
                    $padraoClique = $null
                    if ($elemento.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern,
                        [ref]$padraoClique)) {
                        $padraoClique.Invoke()
                    } elseif (![ComputadorSelene]::ClicarNativo($elemento.Current.NativeWindowHandle)) {
                        if (![ComputadorSelene]::Ativar([IntPtr]$janelaAtual.Current.NativeWindowHandle)) {
                            throw 'Não foi possível ativar a janela. Observe novamente.'
                        }
                        $retangulo = $elemento.Current.BoundingRectangle
                        [void][ComputadorSelene]::SetCursorPos([int]($retangulo.X + $retangulo.Width/2),
                            [int]($retangulo.Y + $retangulo.Height/2))
                        [ComputadorSelene]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
                        [ComputadorSelene]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
                    }
                }
                'digitar' {
                    if (![ComputadorSelene]::Editavel($elemento)) {
                        throw 'Escolha uma referência com editavel=true para digitar. Não use grupos ou rótulos.'
                    }
                    $padrao = $null
                    $editorChromium = $elemento.Current.ControlType -eq [System.Windows.Automation.ControlType]::Edit -and
                        [ComputadorSelene]::Classe($janelaAtual.Current.NativeWindowHandle).StartsWith('Chrome_WidgetWin_')
                    if ($editorChromium) {
                        [ComputadorSelene]::Digitar([IntPtr]$janelaAtual.Current.NativeWindowHandle,
                            $elemento,[string]$comando.texto)
                    } elseif (!$elemento.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern,[ref]$padrao)) {
                        if ([ComputadorSelene]::CampoNativo($elemento.Current.NativeWindowHandle)) {
                            [ComputadorSelene]::Preencher($elemento.Current.NativeWindowHandle,[string]$comando.texto)
                        } else {
                            [ComputadorSelene]::Digitar([IntPtr]$janelaAtual.Current.NativeWindowHandle,
                                $elemento,[string]$comando.texto)
                        }
                    } else {
                        $padrao.SetValue([string]$comando.texto)
                    }
                }
                'pressionar' {
                    if ($elemento) {
                        [ComputadorSelene]::Focar([IntPtr]$janelaAtual.Current.NativeWindowHandle,$elemento)
                    } elseif (![ComputadorSelene]::Ativar([IntPtr]$janelaAtual.Current.NativeWindowHandle)) {
                        throw 'Não foi possível ativar a janela. Observe novamente.'
                    }
                    $foco = [System.Windows.Automation.AutomationElement]::FocusedElement
                    if ($foco -and ($foco.Current.IsPassword -or
                        [ComputadorSelene]::SenhaNativa($foco.Current.NativeWindowHandle))) {
                        throw 'Campos de senha não são permitidos.'
                    }
                    $teclas = @{ Enter=13; Tab=9; Escape=27; Backspace=8; Delete=46; ArrowUp=38; ArrowDown=40;
                        ArrowLeft=37; ArrowRight=39; Home=36; End=35; PageUp=33; PageDown=34;
                        'Control+a'=65; 'Control+c'=67; 'Control+v'=86 }
                    if (!$teclas.ContainsKey([string]$comando.tecla)) { throw 'Tecla inválida.' }
                    [ComputadorSelene]::Pressionar([System.UInt16]$teclas[[string]$comando.tecla],
                        ([string]$comando.tecla).StartsWith('Control+'))
                }
                'rolar' {
                    if (![ComputadorSelene]::Ativar([IntPtr]$janelaAtual.Current.NativeWindowHandle)) {
                        throw 'Não foi possível ativar a janela. Observe novamente.'
                    }
                    $r = $janelaAtual.Current.BoundingRectangle
                    [void][ComputadorSelene]::SetCursorPos([int]($r.X+$r.Width/2),[int]($r.Y+$r.Height/2))
                    $quantidade = if ($comando.direcao -eq 'cima') { 360 } else { -360 }
                    [ComputadorSelene]::mouse_event(2048,0,0,$quantidade,[UIntPtr]::Zero)
                }
                default { throw 'Ação inválida.' }
            }
            Start-Sleep -Milliseconds 150
        }
        $janelas = @()
        $filhas = [System.Windows.Automation.AutomationElement]::RootElement.FindAll(
            [System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
        foreach ($item in $filhas) {
            try {
                if ($item.Current.Name -and !$item.Current.IsOffscreen -and $item.Current.NativeWindowHandle -and
                    $item.Current.ProcessId -ne $comando.processoSelene) {
                    $janelas += @{ janela=[string]$item.Current.NativeWindowHandle; titulo=$item.Current.Name }
                }
            } catch {}
        }
        $identificador = if ($comando.acao -eq 'observar' -and $comando.janela) {
            [long]$comando.janela
        } elseif ($comando.acao -ne 'observar' -and $janelaAtual) {
            [long]$janelaAtual.Current.NativeWindowHandle
        } else { [ComputadorSelene]::GetForegroundWindow().ToInt64() }
        $janelaAtual = if ($identificador) {
            [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$identificador)
        } else { $null }
        if ($identificador -and (!$janelaAtual -or $janelaAtual.Current.IsOffscreen)) { throw 'A janela não está visível.' }
        if ($janelaAtual -and $janelaAtual.Current.ProcessId -eq $comando.processoSelene) {
            $janelaAtual = $null
            $identificador = 0
        }
        $tituloAtual = if ($janelaAtual) { $janelaAtual.Current.Name } else { 'Escolha um aplicativo da lista de janelas' }
        if ($janelaAtual) { [ComputadorSelene]::SolicitarAcessibilidade([IntPtr]$identificador) }
        $referencias = @{}
        $elementos = @()
        $fila = New-Object 'System.Collections.Generic.Queue[System.Windows.Automation.AutomationElement]'
        if ($janelaAtual) { $fila.Enqueue($janelaAtual) }
        $visitados = 0
        $leituraParcial = $false
        $caminhante = [System.Windows.Automation.TreeWalker]::RawViewWalker
        while ($fila.Count -gt 0 -and $visitados -lt 4000) {
            $item = $fila.Dequeue()
            $visitados++
            try {
                $atual = $item.Current
                if ($atual.IsPassword -or [ComputadorSelene]::SenhaNativa($atual.NativeWindowHandle)) { continue }
                $editavel = [ComputadorSelene]::Editavel($item)
                if (!$atual.IsOffscreen -and !$atual.IsPassword -and
                    $atual.BoundingRectangle.Width -gt 0 -and
                    ($editavel -or $atual.Name -or $atual.IsKeyboardFocusable -or $visitados -eq 1 -or
                        [ComputadorSelene]::CampoNativo($atual.NativeWindowHandle))) {
                    $referencia = 'e' + ($elementos.Count+1)
                    $referencias[$referencia] = @{ elemento=$item; nome=$atual.Name; retangulo=$atual.BoundingRectangle }
                    $r = $atual.BoundingRectangle
                    $elementos += @{ referencia=$referencia; nome=$atual.Name.Substring(0,[Math]::Min(300,$atual.Name.Length));
                        tipo=($atual.ControlType.ProgrammaticName + ':' + [ComputadorSelene]::Classe($atual.NativeWindowHandle));
                        habilitado=$atual.IsEnabled; editavel=$editavel; valor=[ComputadorSelene]::Valor($item);
                        x=[int]($r.X+$r.Width/2); y=[int]($r.Y+$r.Height/2) }
                }
                $filho = $caminhante.GetFirstChild($item)
                if (!$filho -and $visitados -eq 1) {
                    foreach ($identificadorFilho in [ComputadorSelene]::Filhas([IntPtr]$identificador)) {
                        $fila.Enqueue([System.Windows.Automation.AutomationElement]::FromHandle($identificadorFilho))
                    }
                }
                while ($filho -and $fila.Count -lt 4000) {
                    $fila.Enqueue($filho)
                    $filho = $caminhante.GetNextSibling($filho)
                }
                if ($filho) { $leituraParcial = $true }
            } catch { if ($visitados -eq 1) { throw } }
        }
        $observacaoAtual = [guid]::NewGuid().ToString()
        $limites = if ($janelaAtual) {
            $r = $janelaAtual.Current.BoundingRectangle
            @{ x=$r.X; y=$r.Y; largura=$r.Width; altura=$r.Height }
        } else { $null }
        $retorno = @{ ok=$true; observacao=$observacaoAtual; janela=[string]$identificador;
            titulo=$tituloAtual; janelas=$janelas; elementos=$elementos; limites=$limites;
            leituraParcial=($leituraParcial -or $fila.Count -gt 0) }
    } catch {
        $observacaoAtual = ''
        $retorno = @{ ok=$false; erro=$_.Exception.Message }
    }
    [Console]::WriteLine(($retorno | ConvertTo-Json -Depth 6 -Compress))
}
`;
