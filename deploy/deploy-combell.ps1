<#
.SYNOPSIS
  Zet de Prestige Automotive-site via FTPS op de Combell-hosting.

.DESCRIPTION
  Uploadt alleen wat live hoort te staan. Uitgesloten: .git, .claude, docs,
  _legacy-squarespace, functions (dat is de Cloudflare-versie), deploy zelf,
  en de bestanden met geheimen.

  Inloggegevens komen uit environment variables, zodat ze niet in dit bestand
  of in git terechtkomen:

      $env:COMBELL_FTP_HOST = "ftp.prestige-automotive.be"
      $env:COMBELL_FTP_USER = "gebruikersnaam"
      $env:COMBELL_FTP_PASS = "wachtwoord"

  Optioneel:
      $env:COMBELL_FTP_ROOT = "/www"   (standaard; sommige pakketten gebruiken /httpdocs)

.EXAMPLE
  .\deploy\deploy-combell.ps1 -DryRun
  Toont wat er zou gebeuren, zonder iets te uploaden. Doe dit altijd eerst.

.EXAMPLE
  .\deploy\deploy-combell.ps1
  Uploadt alles wat nieuw of gewijzigd is.

.EXAMPLE
  .\deploy\deploy-combell.ps1 -Only "contact.html","api/contact.php"
  Duwt enkel die twee bestanden omhoog.

.EXAMPLE
  .\deploy\deploy-combell.ps1 -ConfigFile ..\prestige-config.php
  Zet het geheimenbestand een map BOVEN de webroot. Eenmalig nodig.
#>

[CmdletBinding()]
param(
    # Toon wat er zou gebeuren, upload niets.
    [switch] $DryRun,

    # Upload alles opnieuw, ook wat ongewijzigd lijkt.
    [switch] $Force,

    # Enkel deze paden (relatief aan de projectmap, met / of \).
    [string[]] $Only,

    # Pad naar het ingevulde prestige-config.php. Wordt BOVEN de webroot gezet.
    [string] $ConfigFile,

    # Gewone FTP zonder TLS. Alleen gebruiken als FTPS weigert.
    [switch] $NoSsl,

    # Certificaatcontrole overslaan. Alleen bij een certificaatfout op de FTP-server.
    [switch] $SkipCertCheck
)

$ErrorActionPreference = 'Stop'

# -- Instellingen ------------------------------------------------------------

$ProjectRoot = Split-Path -Parent $PSScriptRoot

$ExcludeDirs = @(
    '.git', '.claude', '.vscode', 'docs', '_legacy-squarespace',
    'functions',          # Cloudflare Pages Function - draait niet op Combell
    'deploy',             # dit script en de config-template
    'node_modules'
)

$ExcludeFiles = @(
    '.gitignore', '.DS_Store', 'Thumbs.db', 'desktop.ini',
    # Geheimen. Deze mogen NOOIT in de webroot belanden: .env is geen PHP, dus
    # een bezoeker zou de inhoud gewoon als tekst kunnen opvragen.
    'prestige-config.php',  # gaat apart, boven de webroot
    '.env', '.env.local'
)

$ExcludeExtensions = @('.md', '.log', '.bak', '.ps1', '.sh', '.zip')

# Tekstbestanden worden altijd opnieuw geupload: ze zijn klein, en een
# wijziging kan toevallig even groot zijn als het origineel.
$AlwaysUpload = @('.html', '.css', '.js', '.php', '.json', '.webmanifest', '.htaccess', '.xml', '.txt')

# -- Inloggegevens -----------------------------------------------------------

$FtpHost = $env:COMBELL_FTP_HOST
$FtpUser = $env:COMBELL_FTP_USER
$FtpPass = $env:COMBELL_FTP_PASS
$FtpRoot = $env:COMBELL_FTP_ROOT
if ([string]::IsNullOrWhiteSpace($FtpRoot)) { $FtpRoot = '/www' }

if (-not $DryRun) {
    $missing = @()
    if ([string]::IsNullOrWhiteSpace($FtpHost)) { $missing += 'COMBELL_FTP_HOST' }
    if ([string]::IsNullOrWhiteSpace($FtpUser)) { $missing += 'COMBELL_FTP_USER' }
    if ([string]::IsNullOrWhiteSpace($FtpPass)) { $missing += 'COMBELL_FTP_PASS' }
    if ($missing.Count -gt 0) {
        Write-Host ""
        Write-Host "Ontbrekende environment variables: $($missing -join ', ')" -ForegroundColor Red
        Write-Host ""
        Write-Host 'Zet ze eerst, bijvoorbeeld:' -ForegroundColor Yellow
        Write-Host '  $env:COMBELL_FTP_HOST = "ftp.prestige-automotive.be"'
        Write-Host '  $env:COMBELL_FTP_USER = "jouw-ftp-gebruiker"'
        Write-Host '  $env:COMBELL_FTP_PASS = "jouw-ftp-wachtwoord"'
        Write-Host ""
        Write-Host 'Je vindt ze in Combell: My products -> Web hosting -> FTP accounts.'
        exit 1
    }
}

$FtpHost = $FtpHost -replace '^ftps?://', '' -replace '/+$', ''
$FtpRoot = '/' + ($FtpRoot -replace '^/+', '' -replace '/+$', '')
$UseSsl  = -not $NoSsl

if ($SkipCertCheck) {
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
}
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

$Credential = $null
if (-not [string]::IsNullOrWhiteSpace($FtpUser)) {
    $Credential = New-Object System.Net.NetworkCredential($FtpUser, $FtpPass)
}

# -- FTP-hulpjes -------------------------------------------------------------

function New-FtpRequest {
    param([string] $RemotePath, [string] $Method)

    # Elk padstuk apart escapen: bestandsnamen bevatten hier haakjes.
    $segments = $RemotePath.Split('/') | Where-Object { $_ -ne '' } |
        ForEach-Object { [System.Uri]::EscapeDataString($_) }
    $uri = "ftp://$FtpHost/" + ($segments -join '/')

    $req = [System.Net.FtpWebRequest]::Create($uri)
    $req.Method      = $Method
    $req.Credentials = $Credential
    $req.EnableSsl   = $UseSsl
    $req.UsePassive  = $true
    $req.UseBinary   = $true
    $req.KeepAlive   = $false
    $req.Timeout     = 60000
    $req.ReadWriteTimeout = 120000
    return $req
}

function Test-FtpStatus {
    param($Exception, [int[]] $AcceptCodes)

    $resp = $Exception.Response
    if ($null -eq $resp) { return $false }
    $code = [int] $resp.StatusCode
    # StatusCode is een enum; de ruwe reply staat in StatusDescription.
    $raw = 0
    if ($resp.StatusDescription -match '^(\d{3})') { $raw = [int] $Matches[1] }
    return ($AcceptCodes -contains $code) -or ($AcceptCodes -contains $raw)
}

function Get-FtpFileSize {
    param([string] $RemotePath)
    try {
        $req  = New-FtpRequest -RemotePath $RemotePath -Method ([System.Net.WebRequestMethods+Ftp]::GetFileSize)
        $resp = $req.GetResponse()
        $size = $resp.ContentLength
        $resp.Close()
        return $size
    } catch [System.Net.WebException] {
        return -1   # bestaat nog niet
    }
}

$script:KnownDirs = New-Object 'System.Collections.Generic.HashSet[string]'

function Confirm-FtpDirectory {
    param([string] $RemoteDir)

    if ([string]::IsNullOrWhiteSpace($RemoteDir)) { return }
    if ($script:KnownDirs.Contains($RemoteDir)) { return }

    $parent = $RemoteDir.Substring(0, [Math]::Max(0, $RemoteDir.LastIndexOf('/')))
    if ($parent -and $parent -ne $RemoteDir) { Confirm-FtpDirectory -RemoteDir $parent }

    try {
        $req  = New-FtpRequest -RemotePath $RemoteDir -Method ([System.Net.WebRequestMethods+Ftp]::MakeDirectory)
        $resp = $req.GetResponse()
        $resp.Close()
        Write-Host "  map aangemaakt: $RemoteDir" -ForegroundColor DarkGray
    } catch [System.Net.WebException] {
        # 550 = bestaat al. Alles anders is een echt probleem.
        if (-not (Test-FtpStatus -Exception $_.Exception -AcceptCodes @(550))) { throw }
    }
    [void] $script:KnownDirs.Add($RemoteDir)
}

function Send-FtpFile {
    param([string] $LocalPath, [string] $RemotePath)

    $req = New-FtpRequest -RemotePath $RemotePath -Method ([System.Net.WebRequestMethods+Ftp]::UploadFile)
    $req.ContentLength = (Get-Item -LiteralPath $LocalPath).Length

    $in  = [System.IO.File]::OpenRead($LocalPath)
    $out = $req.GetRequestStream()
    try {
        $in.CopyTo($out, 81920)
    } finally {
        $out.Close()
        $in.Close()
    }
    $resp = $req.GetResponse()
    $resp.Close()
}

# -- Verzamelen wat er mee moet ----------------------------------------------

function Test-Excluded {
    param([string] $RelPath)

    $parts = $RelPath.Split('/')

    # Elke map in het pad controleren (alles behalve het laatste stuk).
    for ($i = 0; $i -lt $parts.Count - 1; $i++) {
        if ($ExcludeDirs -contains $parts[$i]) { return $true }
    }

    $name = $parts[$parts.Count - 1]
    if ($ExcludeFiles -contains $name) { return $true }

    $ext = [System.IO.Path]::GetExtension($name)
    # .htaccess heeft geen "naam", enkel een extensie - die moet juist wel mee.
    if ($name -eq '.htaccess') { return $false }
    if ($ext -and ($ExcludeExtensions -contains $ext.ToLower())) { return $true }

    return $false
}

Write-Host ""
Write-Host "Prestige Automotive -> Combell" -ForegroundColor Cyan
Write-Host "  lokaal : $ProjectRoot"
if ($DryRun) {
    Write-Host "  server : (dry run, er wordt niets geupload)" -ForegroundColor Yellow
} else {
    # Gebruiker en host apart tonen: de gebruikersnaam bevat zelf een @, dus
    # "user@host" zou er uitzien als een adres met twee apenstaartjes.
    $sslLabel = 'FTPS (versleuteld)'
    if (-not $UseSsl) { $sslLabel = 'FTP (ONVERSLEUTELD)' }
    Write-Host "  server : $FtpHost"
    Write-Host "  gebruiker : $FtpUser"
    Write-Host "  map    : $FtpRoot"
    if ($UseSsl) {
        Write-Host "  modus  : $sslLabel"
    } else {
        Write-Host "  modus  : $sslLabel" -ForegroundColor Yellow
    }
}
Write-Host ""

$files = Get-ChildItem -LiteralPath $ProjectRoot -Recurse -File -Force |
    ForEach-Object {
        $rel = $_.FullName.Substring($ProjectRoot.Length + 1) -replace '\\', '/'
        [PSCustomObject]@{ Full = $_.FullName; Rel = $rel; Size = $_.Length }
    } |
    Where-Object { -not (Test-Excluded -RelPath $_.Rel) }

if ($Only) {
    $wanted = $Only | ForEach-Object { ($_ -replace '\\', '/').TrimStart('./') }
    $files = $files | Where-Object {
        $rel = $_.Rel
        ($wanted | Where-Object { $rel -eq $_ -or $rel -like "$_/*" -or $rel -like $_ }).Count -gt 0
    }
    if (-not $files) {
        Write-Host "Geen bestanden gevonden voor -Only $($Only -join ', ')" -ForegroundColor Red
        exit 1
    }
}

$files = @($files | Sort-Object Rel)

if ($files.Count -eq 0) {
    Write-Host "Niets te uploaden." -ForegroundColor Yellow
    exit 0
}

Write-Host ("{0} bestand(en) in scope, {1:N1} MB" -f $files.Count, (($files | Measure-Object Size -Sum).Sum / 1MB))
Write-Host ""

if ($DryRun) {
    foreach ($f in $files) {
        Write-Host ("  {0,-55} {1,8:N0} KB" -f $f.Rel, ($f.Size / 1KB))
    }
    Write-Host ""
    Write-Host "Dry run: er is niets geupload. Laat -DryRun weg om echt te deployen." -ForegroundColor Yellow
    exit 0
}

# -- Verbinding eerst testen -------------------------------------------------
# Eén test vooraf, zodat een verkeerd wachtwoord of een server zonder FTPS
# één duidelijke melding geeft in plaats van 54 identieke fouten.

function Test-FtpConnection {
    try {
        $req  = New-FtpRequest -RemotePath $FtpRoot -Method ([System.Net.WebRequestMethods+Ftp]::PrintWorkingDirectory)
        $resp = $req.GetResponse()
        $resp.Close()
        return $null
    } catch [System.Net.WebException] {
        return $_.Exception
    } catch {
        return $_.Exception
    }
}

Write-Host "Verbinding testen..." -ForegroundColor DarkGray
$connError = Test-FtpConnection
if ($null -ne $connError) {
    $msg = $connError.Message
    Write-Host ""

    if ($UseSsl -and ($msg -match '500' -or $msg -match 'Syntax error' -or $msg -match 'AUTH')) {
        Write-Host "Deze FTP-server ondersteunt geen FTPS." -ForegroundColor Red
        Write-Host ""
        Write-Host "Het script begint met 'AUTH TLS' om de verbinding te versleutelen;"
        Write-Host "deze server antwoordt daarop met '500 AUTH not understood'."
        Write-Host ""
        Write-Host "Draai opnieuw met -NoSsl:" -ForegroundColor Yellow
        Write-Host "  .\deploy\deploy-combell.ps1 -NoSsl"
        Write-Host ""
        Write-Host "Let op: dan gaan je gebruikersnaam en wachtwoord onversleuteld" -ForegroundColor Yellow
        Write-Host "over de lijn. Wissel het FTP-wachtwoord daarna om." -ForegroundColor Yellow
    }
    elseif ($msg -match '530') {
        Write-Host "Inloggen geweigerd (530): gebruikersnaam of wachtwoord klopt niet." -ForegroundColor Red
        Write-Host ""
        Write-Host "Controleer COMBELL_FTP_USER. Bij Combell is dat geen domeinnaam,"
        Write-Host "maar iets in de vorm  gebruiker@gebruiker."
    }
    elseif ($msg -match '550') {
        Write-Host "Map niet gevonden (550): $FtpRoot" -ForegroundColor Red
        Write-Host ""
        Write-Host "Controleer COMBELL_FTP_ROOT. Kijk in de File Manager welke map"
        Write-Host "de documentroot van de website is."
    }
    else {
        Write-Host "Verbinden mislukt: $msg" -ForegroundColor Red
    }

    Write-Host ""
    exit 1
}
Write-Host "Verbinding OK." -ForegroundColor Green
Write-Host ""

# -- Uploaden ----------------------------------------------------------------

$uploaded = 0; $skipped = 0; $failed = @(); $i = 0

foreach ($f in $files) {
    $i++
    $remote = "$FtpRoot/$($f.Rel)"
    $remoteDir = $remote.Substring(0, $remote.LastIndexOf('/'))
    $ext = [System.IO.Path]::GetExtension($f.Rel).ToLower()
    $isText = ($AlwaysUpload -contains $ext) -or ($f.Rel -like '*.htaccess')

    Write-Progress -Activity 'Uploaden naar Combell' -Status $f.Rel -PercentComplete (($i / $files.Count) * 100)

    try {
        Confirm-FtpDirectory -RemoteDir $remoteDir

        if (-not $Force -and -not $isText) {
            $remoteSize = Get-FtpFileSize -RemotePath $remote
            if ($remoteSize -eq $f.Size) {
                $skipped++
                continue
            }
        }

        Send-FtpFile -LocalPath $f.Full -RemotePath $remote
        $uploaded++
        Write-Host ("  ok  {0}" -f $f.Rel) -ForegroundColor Green
    } catch {
        $failed += [PSCustomObject]@{ Path = $f.Rel; Error = $_.Exception.Message }
        Write-Host ("  FOUT {0} - {1}" -f $f.Rel, $_.Exception.Message) -ForegroundColor Red
    }
}

Write-Progress -Activity 'Uploaden naar Combell' -Completed

# -- Geheimenbestand, boven de webroot ---------------------------------------

if ($ConfigFile) {
    if (-not (Test-Path -LiteralPath $ConfigFile)) {
        Write-Host ""
        Write-Host "Config-bestand niet gevonden: $ConfigFile" -ForegroundColor Red
        Write-Host "Kopieer deploy\prestige-config.example.php, vul het in, en wijs ernaar."
    } else {
        $parent = $FtpRoot.Substring(0, [Math]::Max(1, $FtpRoot.LastIndexOf('/')))
        if ($parent -eq '') { $parent = '/' }
        $remoteCfg = ($parent.TrimEnd('/')) + '/prestige-config.php'
        Write-Host ""
        Write-Host "Config uploaden naar $remoteCfg (boven de webroot)" -ForegroundColor Cyan
        try {
            Send-FtpFile -LocalPath (Resolve-Path -LiteralPath $ConfigFile).Path -RemotePath $remoteCfg
            Write-Host "  ok  prestige-config.php" -ForegroundColor Green
        } catch {
            Write-Host ("  FOUT - {0}" -f $_.Exception.Message) -ForegroundColor Red
            $failed += [PSCustomObject]@{ Path = 'prestige-config.php'; Error = $_.Exception.Message }
        }
    }
}

# -- Samenvatting ------------------------------------------------------------

Write-Host ""
Write-Host "Klaar: $uploaded geupload, $skipped ongewijzigd overgeslagen, $($failed.Count) mislukt." -ForegroundColor Cyan
if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host "Mislukt:" -ForegroundColor Red
    $failed | ForEach-Object { Write-Host ("  {0} - {1}" -f $_.Path, $_.Error) }
    exit 1
}

Write-Host ""
Write-Host "Controleer nu:" -ForegroundColor Yellow
Write-Host "  1. https://prestige-automotive.be              laadt met logo en foto's"
Write-Host "  2. https://prestige-automotive.be/te-koop.html toont de auto's uit Firestore"
Write-Host "  3. het contactformulier op /contact.html       verstuur een testbericht"
Write-Host ""
