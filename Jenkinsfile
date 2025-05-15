pipeline {
    agent any

    environment {
        NODE_ENV = 'production'
    }

    tools {
        nodejs 'nodejs-22-6-0'
    }

    stages {
        stage('Checkout Code') {
            steps {
                echo '📥 Checking out code....'
                checkout scm
            }
        }

        stage('VM Node Version') {
            steps {
                sh '''
                    node -v
                    npm -v
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                echo '🔧 Installing dependencies....'
                sh 'npm install --no-audit'
                echo '🔧 Dependencies installed successfully!'
            }
        }

        stage('Dependency Check') {
            parallel {  
                stage('NPM Dependency Audit') {
                    steps {
                        echo '🔍 Running npm audit....'
                        sh 'npm audit --audit-level=critical'
                        echo '🔍 Audit completed successfully!' 
                    }
                }

                stage('OWASP Dependency Check') {
                    steps {
                        dependencyCheck additionalArguments: '''
                            --scan \'./\'
                            --out  \'./\' 
                            --format \'ALL\' 
                            --prettyPrint
                            --data /var/lib/jenkins/owasp-data
                        ''', odcInstallation: 'OWASP-DepCheck'

                        dependencyCheckPublisher failedTotalCritical: 1, pattern: 'dependency-check-report.xml', stopBuild: true

                        stage('Publish Dependency Check Report') {
                            steps {
                                echo '📊 Publishing OWASP Dependency Check report....'

                                publishHTML(target: [
                                    reportName: 'OWASP Dependency Check Report',
                                    reportDir: '.',
                                    reportFiles: 'dependency-check-report.html',
                                    alwaysLinkToLastBuild: true,
                                    keepAll: true,
                                    allowMissing: false
                                ])

                                echo '📦 Archiving HTML report...'
                                archiveArtifacts artifacts: 'dependency-check-report.html', fingerprint: true

                                echo '🧪 Publishing JUnit results...'
                                junit allowEmptyResults: true, testResults: 'dependency-check-junit.xml'
                            }
                        }
                    }
                }
            }
        }
    }

    post {
        success {
            echo '✅ Build completed successfully!'
        }
        failure {
            echo '❌ Build failed. Check the logs.'
        }
    }
}